/**
 * Recurring step: create DocumentDB indexes declared in INDEXES.
 * Idempotent: skips an index when the same name and key pattern already exist.
 * createIndex throws (and this step fails) when the name exists with a different key pattern.
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
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, created: number, skipped: number, error?: string}>}
 */
async function ensureIndexes(db) {
    console.log('🔄 Ensuring DocumentDB indexes...');
    let created = 0;
    let skipped = 0;

    try {
        for (const spec of INDEXES) {
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
