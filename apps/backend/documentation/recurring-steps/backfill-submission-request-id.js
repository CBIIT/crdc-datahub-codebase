/**
 * Recurring step: backfill Submission.submissionRequestID from the linked ApprovedStudy.applicationID.
 * Idempotent: only updates submissions where submissionRequestID is missing, null, or empty string.
 * Repairs records whose study gained an applicationID after the submission was created.
 *
 * Usage: Called by the current release migration orchestrator (e.g. 3.7.1)
 */

const SUBMISSIONS_COLLECTION = 'submissions';
const APPROVED_STUDIES_COLLECTION = 'approvedStudies';

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, matchedCount?: number, modifiedCount?: number, skippedStudies?: number, error?: string}>}
 */
async function backfillSubmissionRequestID(db) {
    console.log('🔄 Backfilling Submission.submissionRequestID from study.applicationID...');

    const submissions = db.collection(SUBMISSIONS_COLLECTION);
    const approvedStudies = db.collection(APPROVED_STUDIES_COLLECTION);

    try {
        const missingFilter = {
            $or: [
                { submissionRequestID: { $exists: false } },
                { submissionRequestID: null },
                { submissionRequestID: '' }
            ]
        };

        // Only studies referenced by submissions still missing the field need to be resolved
        const studyIDs = await submissions.distinct('studyID', missingFilter);
        if (studyIDs.length === 0) {
            console.log('   ✅ No submissions require backfill');
            return {
                success: true,
                message: 'No submissions required backfill',
                matchedCount: 0,
                modifiedCount: 0,
                skippedStudies: 0
            };
        }

        const studies = await approvedStudies
            .find(
                { _id: { $in: studyIDs }, applicationID: { $exists: true, $nin: [null, ''] } },
                { projection: { _id: 1, applicationID: 1 } }
            )
            .toArray();

        const skippedStudies = studyIDs.length - studies.length;
        if (studies.length === 0) {
            console.log(`   ⚠️  No linked studies have an applicationID (${skippedStudies} study/studies skipped)`);
            return {
                success: true,
                message: 'No linked studies have an applicationID',
                matchedCount: 0,
                modifiedCount: 0,
                skippedStudies
            };
        }

        const operations = studies.map(({ _id, applicationID }) => ({
            updateMany: {
                filter: { studyID: _id, ...missingFilter },
                update: { $set: { submissionRequestID: applicationID } }
            }
        }));

        const result = await submissions.bulkWrite(operations, { ordered: false });
        const matchedCount = result.matchedCount ?? 0;
        const modifiedCount = result.modifiedCount ?? 0;

        console.log(`   ✅ Matched ${matchedCount}, modified ${modifiedCount} (${skippedStudies} study/studies had no applicationID)`);
        return {
            success: true,
            message: `Set submissionRequestID on ${modifiedCount} submission(s)`,
            matchedCount,
            modifiedCount,
            skippedStudies
        };
    } catch (error) {
        console.error('   ❌ Error backfilling Submission.submissionRequestID:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    backfillSubmissionRequestID
};
