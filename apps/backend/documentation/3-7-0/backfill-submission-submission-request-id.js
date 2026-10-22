/**
 * 3.7.0 migration step: backfill Submission.submissionRequestID (recurring).
 *
 * Delegates to documentation/recurring-steps/backfill-submission-request-id.js.
 *
 * Usage: Called by the 3.7.0 and 3.7.1 migration orchestrators
 */

/**
 * Orchestrator entry point for this migration step.
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, matchedCount?: number, modifiedCount?: number, skippedStudies?: number, error?: string}>}
 */
async function executeBackfillSubmissionRequestID(db) {
    console.log('🔄 Executing Submission.submissionRequestID backfill (recurring)...');

    try {
        const { backfillSubmissionRequestID } = require('../recurring-steps/backfill-submission-request-id');
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
    executeBackfillSubmissionRequestID
};
