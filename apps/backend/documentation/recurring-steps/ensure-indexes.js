/**
 * Recurring step: create DocumentDB indexes declared in INDEXES.
 * Awaits each createIndex so startup does not listen until the catalog is processed.
 * Idempotent: matches on index properties (keys and optional expireAfterSeconds), not name alone.
 * Same properties and same name: skip. Same properties, different name: warning and skip.
 * Planned name taken by an index with different keys: warning and create under a suffixed name.
 * Same name and keys with expireAfterSeconds mismatch: error, skip (no drop/recreate).
 * createIndex errors are logged; remaining catalog entries still run.
 * Concurrent index builds and equivalent-index-exists errors refresh the cached index list
 * and retry that spec a limited number of times.
 * Missing collections: logs an error, does not create the collection, skips specs for
 * that collection, continues other collections, and returns success: false.
 *
 * Usage: Called by the current release migration orchestrator (e.g. 3.7.0)
 */

const {
    USER_COLLECTION,
    APPLICATION_COLLECTION,
    PENDING_PVS_COLLECTION,
    BATCH_COLLECTION,
    SUBMISSIONS_COLLECTION,
    SESSION_COLLECTION,
    RELEASE_DATA_RECORDS_COLLECTION,
    APPROVED_STUDIES_COLLECTION,
    VALIDATION_COLLECTION,
    PROPERTY_PVS_COLLECTION,
    QC_RESULTS_COLLECTION,
    DATA_RECORDS_COLLECTION,
} = require('../../crdc-datahub-database-drivers/database-constants');

const CREATE_INDEX_MAX_ATTEMPTS = 3;
const CREATE_INDEX_RETRY_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 500;
const ALLOCATE_INDEX_NAME_MAX_ATTEMPTS = 20;

/**
 * Indexes to ensure. Add new entries here in a later change.
 * @type {{ collection: string, keys: object, name: string, expireAfterSeconds?: number }[]}
 */
const INDEXES = [
    {
        collection: USER_COLLECTION,
        keys: { 'institution._id': 1, role: 1 },
        name: 'institution_id_role',
    },
    {
        collection: PENDING_PVS_COLLECTION,
        keys: { submissionID: 1 },
        name: 'submissionID_1',
    },
    {
        collection: BATCH_COLLECTION,
        keys: { submissionID: 1, createdAt: -1 },
        name: 'submissionID_1_createdAt_-1',
    },
    {
        collection: SUBMISSIONS_COLLECTION,
        keys: { studyID: 1, dataCommons: 1, status: 1 },
        name: 'studyID_1_dataCommons_1_status_1',
    },
    {
        collection: SESSION_COLLECTION,
        keys: { expires: 1 },
        name: 'expires_1',
        expireAfterSeconds: 0,
    },
    {
        collection: RELEASE_DATA_RECORDS_COLLECTION,
        keys: { dataCommons: 1, nodeType: 1, nodeID: 1 },
        name: 'dataCommons_nodeType_nodeID',
    },
    {
        collection: RELEASE_DATA_RECORDS_COLLECTION,
        keys: { CRDC_ID: 1 },
        name: 'CRDC_ID',
    },
    {
        collection: RELEASE_DATA_RECORDS_COLLECTION,
        keys: { dataCommons: 1, nodeType: 1, nodeID: 1, status: 1 },
        name: 'dataCommons_1_nodeType_1_nodeID_1_status_1',
    },
    {
        collection: APPROVED_STUDIES_COLLECTION,
        keys: { programID: 1 },
        name: 'programID_1',
    },
    {
        collection: VALIDATION_COLLECTION,
        keys: { submissionID: 1 },
        name: 'submissionID_1',
    },
    {
        collection: PROPERTY_PVS_COLLECTION,
        keys: { model: 1, version: 1, property: 1 },
        name: 'model_1_version_1_property_1',
    },
    {
        collection: QC_RESULTS_COLLECTION,
        keys: { submissionID: 1 },
        name: 'submissionID_1',
    },
    {
        collection: DATA_RECORDS_COLLECTION,
        keys: { submissionID: 1, nodeType: 1, nodeID: 1 },
        name: 'submissionID_nodeType_nodeID',
    },
    {
        collection: DATA_RECORDS_COLLECTION,
        keys: { dataCommons: 1, nodeType: 1, nodeID: 1 },
        name: 'dataCommons_nodeType_nodeID',
    },
    {
        collection: DATA_RECORDS_COLLECTION,
        keys: { submissionID: 1 },
        name: 'submissionID_index',
    },
    {
        collection: DATA_RECORDS_COLLECTION,
        keys: { studyID: 1, entityType: 1, nodeID: 1 },
        name: 'studyID_entityType_nodeID',
    },
    {
        collection: DATA_RECORDS_COLLECTION,
        keys: { submissionID: 1, status: 1, nodeType: 1, nodeID: 1 },
        name: 'submissionID_1_status_1_nodeType_1_nodeID_1',
    },
    {
        collection: DATA_RECORDS_COLLECTION,
        keys: {
            submissionID: 1,
            nodeType: 1,
            'parents.parentType': 1,
            'parents.parentIDPropName': 1,
            'parents.parentIDValue': 1,
        },
        name: 'submissionID_1_nodeType_1_parents.parentType_1_parents.parentIDPropName_1_parents.parentIDValue_1',
    },
    {
        collection: APPLICATION_COLLECTION,
        keys: { nextRevisionId: 1 },
        name: 'nextRevisionId_1',
    },
];

/**
 * @param {object} left Index key pattern
 * @param {object} right Index key pattern
 * @returns {boolean}
 */
function keysEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * True when an existing index matches the catalog spec (keys and optional TTL).
 * @param {{ keys: object, expireAfterSeconds?: number }} spec
 * @param {{ key: object, expireAfterSeconds?: number }} existingIndex
 * @returns {boolean}
 */
function indexPropertiesEqual(spec, existingIndex) {
    if (!keysEqual(spec.keys, existingIndex.key)) {
        return false;
    }
    if (spec.expireAfterSeconds !== undefined) {
        return existingIndex.expireAfterSeconds === spec.expireAfterSeconds;
    }
    return true;
}

/**
 * Picks the catalog name when free; otherwise a random suffixed name unused in the collection.
 * @param {{ name: string }} spec
 * @param {{ name: string }[]} indexes
 * @returns {string}
 */
function resolveCreateIndexName(spec, indexes) {
    if (!indexes.some((idx) => idx.name === spec.name)) {
        return spec.name;
    }
    for (let attempt = 0; attempt < ALLOCATE_INDEX_NAME_MAX_ATTEMPTS; attempt += 1) {
        const candidate = `${spec.name}_${Math.floor(Math.random() * 1e9)}`;
        if (!indexes.some((idx) => idx.name === candidate)) {
            return candidate;
        }
    }
    throw new Error(`could not allocate index name for planned name ${spec.name}`);
}

/**
 * @param {string} [message]
 * @returns {boolean}
 */
function isIndexBuildInProgress(message) {
    const text = (message || '').toLowerCase();
    return text.includes('already in progress') || text.includes('index build');
}

/**
 * @param {string} [message]
 * @returns {boolean}
 */
function isIndexAlreadyExists(message) {
    const text = (message || '').toLowerCase();
    return text.includes('already exists') || text.includes('equivalent index');
}

/**
 * @param {{ collection: string, name: string }} spec
 * @param {string} detail
 * @returns {string}
 */
function specError(spec, detail) {
    return `${spec.collection}.${spec.name}: ${detail}`;
}

/**
 * Creates catalog indexes when missing. Property-first idempotency: skips when an index with
 * the same keys (and TTL when declared) already exists; warns when only the name differs.
 * Creates under a suffixed name when the planned name is taken by a different index.
 * The chosen create name is fixed for each catalog spec across createIndex retries.
 * expireAfterSeconds mismatch on the same name and keys is an error (no drop/recreate).
 * Continues after createIndex errors and missing collections (does not create collections).
 * Concurrent builds and equivalent-index-exists errors refresh the index cache and retry.
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, created: number, skipped: number, error?: string}>}
 */
async function ensureIndexes(db) {
    console.log('🔄 Ensuring DocumentDB indexes...');
    let created = 0;
    let skipped = 0;
    const errors = [];

    try {
        const existingCollections = await db.listCollections({}, { nameOnly: true }).toArray();
        const existingNames = new Set(existingCollections.map((entry) => entry.name));
        const missingLogged = new Set();
        const collectionState = new Map();

        for (const spec of INDEXES) {
            try {
                if (!existingNames.has(spec.collection)) {
                    const message = `Collection does not exist: ${spec.collection}`;
                    if (!missingLogged.has(spec.collection)) {
                        console.error(`❌ ${message}`);
                        missingLogged.add(spec.collection);
                        errors.push(message);
                    }
                    continue;
                }

                let resolved = false;
                let pendingCreateIndexName;
                let suffixedNameWarned = false;
                for (let attempt = 1; attempt <= CREATE_INDEX_MAX_ATTEMPTS && !resolved; attempt += 1) {
                    let state = collectionState.get(spec.collection);
                    if (!state) {
                        const collection = db.collection(spec.collection);
                        state = { collection, indexes: [...await collection.indexes()] };
                        collectionState.set(spec.collection, state);
                    }

                    const byName = state.indexes.find((idx) => idx.name === spec.name);
                    const byProperties = state.indexes.find((idx) => indexPropertiesEqual(spec, idx));

                    if (byProperties && byProperties.name === spec.name) {
                        console.log(`   ⏭️  ${spec.collection}.${spec.name} already exists`);
                        skipped += 1;
                        resolved = true;
                        continue;
                    }

                    if (byProperties) {
                        console.warn(
                            `   ⚠️  ${spec.collection}: catalog index ${spec.name} matches existing index `
                            + `${byProperties.name} (same properties); skipping`
                        );
                        skipped += 1;
                        resolved = true;
                        continue;
                    }

                    if (
                        byName
                        && keysEqual(byName.key, spec.keys)
                        && spec.expireAfterSeconds !== undefined
                        && byName.expireAfterSeconds !== spec.expireAfterSeconds
                    ) {
                        const detail = `exists with different expireAfterSeconds `
                            + `(catalog ${spec.expireAfterSeconds}, existing ${byName.expireAfterSeconds}); skipping`;
                        console.warn(`   ⚠️  ${spec.collection}.${spec.name} ${detail}`);
                        errors.push(specError(spec, detail));
                        skipped += 1;
                        resolved = true;
                        continue;
                    }

                    try {
                        if (pendingCreateIndexName === undefined) {
                            pendingCreateIndexName = resolveCreateIndexName(spec, state.indexes);
                            if (pendingCreateIndexName !== spec.name && !suffixedNameWarned) {
                                console.warn(
                                    `   ⚠️  ${spec.collection}: planned index name ${spec.name} is already used; `
                                    + `creating as ${pendingCreateIndexName}`
                                );
                                suffixedNameWarned = true;
                            }
                        }
                    } catch (nameError) {
                        console.error(`❌ Error ensuring ${spec.collection}.${spec.name}:`, nameError.message);
                        errors.push(specError(spec, nameError.message));
                        resolved = true;
                        continue;
                    }

                    const createIndexName = pendingCreateIndexName;

                    const createIndexOptions = { name: createIndexName, background: true };
                    if (spec.expireAfterSeconds !== undefined) {
                        createIndexOptions.expireAfterSeconds = spec.expireAfterSeconds;
                    }
                    try {
                        await state.collection.createIndex(spec.keys, createIndexOptions);
                        const recorded = { name: createIndexName, key: spec.keys };
                        if (spec.expireAfterSeconds !== undefined) {
                            recorded.expireAfterSeconds = spec.expireAfterSeconds;
                        }
                        state.indexes.push(recorded);
                        created += 1;
                        const createdLabel = createIndexName === spec.name
                            ? spec.name
                            : `${createIndexName} (planned ${spec.name})`;
                        console.log(`   ✅ Created ${spec.collection}.${createdLabel}`);
                        resolved = true;
                    } catch (createError) {
                        const canRetryBuild = isIndexBuildInProgress(createError.message)
                            && attempt < CREATE_INDEX_MAX_ATTEMPTS;
                        if (canRetryBuild) {
                            collectionState.delete(spec.collection);
                            await new Promise((resolve) => {
                                setTimeout(resolve, CREATE_INDEX_RETRY_DELAY_MS);
                            });
                            continue;
                        }
                        if (isIndexAlreadyExists(createError.message)
                            && attempt < CREATE_INDEX_MAX_ATTEMPTS) {
                            state.indexes = [...await state.collection.indexes()];
                            continue;
                        }
                        console.error(`❌ Error ensuring ${spec.collection}.${spec.name}:`, createError.message);
                        errors.push(specError(spec, createError.message));
                        resolved = true;
                    }
                }
            } catch (error) {
                console.error(`❌ Error ensuring ${spec.collection}.${spec.name}:`, error.message);
                errors.push(specError(spec, error.message));
            }
        }

        if (errors.length > 0) {
            const error = errors.join('; ');
            console.error('❌ Error ensuring indexes:', error);
            return { success: false, created, skipped, error };
        }

        console.log(`✅ Index ensure completed: ${created} created, ${skipped} skipped`);
        return { success: true, created, skipped };
    } catch (error) {
        console.error('❌ Error ensuring indexes:', error.message);
        return { success: false, created, skipped, error: error.message };
    }
}

module.exports = {
    INDEXES,
    ensureIndexes,
    resolveCreateIndexName,
};
