/**
 * Recurring step: create DocumentDB indexes declared in INDEXES.
 * Idempotent: skips an index when the same name and key pattern already exist.
 * createIndex throws (and this step fails) when the name exists with a different key pattern.
 * Missing collections: logs an error, skips remaining indexes for that collection, continues
 * other collections, and still returns success: false.
 *
 * Usage: Called by the current release migration orchestrator (e.g. 3.7.0)
 */

const {
    USER_COLLECTION,
    RELEASE_DATA_RECORDS_COLLECTION,
    DATA_RECORDS_COLLECTION,
    APPROVED_STUDIES_COLLECTION,
    PENDING_PVS_COLLECTION,
    QC_RESULTS_COLLECTION,
    VALIDATION_COLLECTION,
} = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * Indexes to ensure. Add new entries here in a later change.
 * @type {{ collection: string, keys: object, name: string }[]}
 */
const INDEXES = [
    {
        collection: USER_COLLECTION,
        keys: { 'institution._id': 1, role: 1 },
        name: 'institution_id_role',
    },
    {
        collection: RELEASE_DATA_RECORDS_COLLECTION,
        keys: { CRDC_ID: 1 },
        name: 'CRDC_ID_1',
    },
    {
        collection: RELEASE_DATA_RECORDS_COLLECTION,
        keys: { dataCommons: 1, nodeType: 1, nodeID: 1 },
        name: 'dataCommons_nodeType_nodeID',
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
        collection: APPROVED_STUDIES_COLLECTION,
        keys: { programID: 1 },
        name: 'programID_1',
    },
    {
        collection: PENDING_PVS_COLLECTION,
        keys: { submissionID: 1 },
        name: 'submissionID_1',
    },
    {
        collection: QC_RESULTS_COLLECTION,
        keys: { submissionID: 1 },
        name: 'submissionID_1',
    },
    {
        collection: VALIDATION_COLLECTION,
        keys: { submissionID: 1 },
        name: 'submissionID_1',
    },
];

/**
 * Creates catalog indexes when missing; no-ops when name and keys already match.
 * Missing catalog collections are skipped (remaining indexes for that collection too);
 * other collections still get indexes, but the step returns success: false.
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, created: number, skipped: number, error?: string}>}
 */
async function ensureIndexes(db) {
    console.log('🔄 Ensuring DocumentDB indexes...');
    let created = 0;
    let skipped = 0;
    const missingCollections = [];

    try {
        const existingNames = new Set(
            (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name)
        );

        for (const spec of INDEXES) {
            if (!existingNames.has(spec.collection)) {
                if (!missingCollections.includes(spec.collection)) {
                    missingCollections.push(spec.collection);
                    console.error(`❌ Collection ${spec.collection} does not exist; skipping its indexes`);
                }
                continue;
            }
            const collection = db.collection(spec.collection);
            const existing = await collection.indexes();
            const match = existing.find((idx) => idx.name === spec.name);
            if (match && JSON.stringify(match.key) === JSON.stringify(spec.keys)) {
                skipped += 1;
                console.log(`   ⏭️  ${spec.collection}.${spec.name} already exists`);
                continue;
            }
            await collection.createIndex(spec.keys, { name: spec.name });
            created += 1;
            console.log(`   ✅ Created ${spec.collection}.${spec.name}`);
        }

        if (missingCollections.length > 0) {
            const error = `Collection does not exist: ${missingCollections.join(', ')}`;
            console.error('❌ Error ensuring indexes:', error);
            console.log(`✅ Index ensure completed: ${created} created, ${skipped} skipped`);
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
