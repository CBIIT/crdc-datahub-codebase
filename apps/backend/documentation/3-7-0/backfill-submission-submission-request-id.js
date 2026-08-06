/**
 * Migration: Backfill Submission.submissionRequestID from the linked ApprovedStudy.applicationID
 *
 * Idempotent: safe to run multiple times.
 *
 * Usage: Called by the 3.7.0 migration orchestrator
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
                { submissionRequestID: null }
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

/**
 * Orchestrator entry point for this migration step.
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, matchedCount?: number, modifiedCount?: number, skippedStudies?: number, error?: string}>}
 */
async function executeBackfillSubmissionRequestID(db) {
    console.log('🔄 Executing Submission.submissionRequestID backfill...');

    try {
        const result = await backfillSubmissionRequestID(db);

        if (result.success) {
            console.log('✅ Submission.submissionRequestID backfill completed successfully');
        } else {
            console.log('❌ Submission.submissionRequestID backfill failed');
        }

        return result;
    } catch (error) {
        console.error('❌ Error executing Submission.submissionRequestID backfill:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    backfillSubmissionRequestID,
    executeBackfillSubmissionRequestID
};
