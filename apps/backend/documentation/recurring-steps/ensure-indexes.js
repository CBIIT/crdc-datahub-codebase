/**
 * Recurring step: create DocumentDB indexes declared in INDEXES.
 * Awaits each createIndex so startup does not listen until the catalog is processed.
 * Idempotent: skips when the same name and key pattern already exist.
 * Same key pattern under a different name: logs a warning with both names and skips.
 * Same name with different keys, or expireAfterSeconds mismatch: logs an error, does not
 * drop/recreate, continues remaining specs, and returns success: false.
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
 * Creates catalog indexes when missing. Skips when name and keys already match, or when
 * the same keys exist under a different name (warning). Same name with different keys or
 * expireAfterSeconds mismatch is an error (no drop/recreate). Continues after createIndex
 * errors and missing collections (does not create collections). Concurrent builds and
 * equivalent-index-exists errors refresh the index cache and retry that spec.
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
                for (let attempt = 1; attempt <= CREATE_INDEX_MAX_ATTEMPTS && !resolved; attempt += 1) {
                    let state = collectionState.get(spec.collection);
                    if (!state) {
                        const collection = db.collection(spec.collection);
                        state = { collection, indexes: [...await collection.indexes()] };
                        collectionState.set(spec.collection, state);
                    }

                    const byName = state.indexes.find((idx) => idx.name === spec.name);
                    const byKeys = state.indexes.find((idx) => keysEqual(idx.key, spec.keys));

                    if (byName && keysEqual(byName.key, spec.keys)) {
                        if (
                            spec.expireAfterSeconds !== undefined
                            && byName.expireAfterSeconds !== spec.expireAfterSeconds
                        ) {
                            const detail = `exists with different expireAfterSeconds `
                                + `(catalog ${spec.expireAfterSeconds}, existing ${byName.expireAfterSeconds}); skipping`;
                            console.warn(`   ⚠️  ${spec.collection}.${spec.name} ${detail}`);
                            errors.push(specError(spec, detail));
                        } else {
                            console.log(`   ⏭️  ${spec.collection}.${spec.name} already exists`);
                        }
                        skipped += 1;
                        resolved = true;
                        continue;
                    }

                    if (byName) {
                        const detail = `exists with different keys `
                            + `(catalog ${JSON.stringify(spec.keys)}, existing ${JSON.stringify(byName.key)})`;
                        console.warn(`   ⚠️  ${spec.collection}.${spec.name} ${detail}`);
                        errors.push(specError(spec, detail));
                        resolved = true;
                        continue;
                    }

                    if (byKeys) {
                        console.warn(
                            `   ⚠️  ${spec.collection}: catalog index ${spec.name} matches existing index ${byKeys.name} `
                            + '(same keys); skipping'
                        );
                        skipped += 1;
                        resolved = true;
                        continue;
                    }

                    const createIndexOptions = { name: spec.name, background: true };
                    if (spec.expireAfterSeconds !== undefined) {
                        createIndexOptions.expireAfterSeconds = spec.expireAfterSeconds;
                    }
                    try {
                        await state.collection.createIndex(spec.keys, createIndexOptions);
                        const recorded = { name: spec.name, key: spec.keys };
                        if (spec.expireAfterSeconds !== undefined) {
                            recorded.expireAfterSeconds = spec.expireAfterSeconds;
                        }
                        state.indexes.push(recorded);
                        created += 1;
                        console.log(`   ✅ Created ${spec.collection}.${spec.name}`);
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
};
