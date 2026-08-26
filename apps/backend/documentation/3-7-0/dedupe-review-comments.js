/**
 * Migration: Remove duplicated review comments from resumed-SRF history events (CRDCDH-3894)
 *
 * Background:
 * `ApplicationService.resumeInquiredApplication` used to copy the review comment from the
 * preceding history event onto the event it created when a user resumed an Inquired SRF.
 * That event was recorded as "In Progress" before the status was renamed to "In Revision",
 * so both statuses carry the bad data. The UI lists every history event that has a review
 * comment, so those copies render as duplicates.
 *
 * Safety:
 * This migration is deliberately narrow. A comment is only removed when ALL of the
 * following hold, which is the exact signature the old carry-over code produced:
 *   1. The event status is "In Revision" or "In Progress".
 *   2. The event has a non-empty review comment.
 *   3. It is not the first event in the history.
 *   4. The immediately preceding event has an identical (trimmed) review comment.
 *   5. The immediately preceding event is NOT "Canceled"/"Deleted" - an event following one
 *      of those is a restore event whose comment is the user-supplied restore reason and
 *      must be preserved.
 * Updates are applied with $unset on the exact array index, guarded by a filter that
 * re-asserts the status and comment, so a concurrent write cannot cause the wrong removal.
 *
 * Idempotent: safe to run multiple times.
 *
 * Usage: Called by the 3.7.0 migration orchestrator.
 *        Set DEDUPE_DRY_RUN=true to report without writing.
 */

const APPLICATIONS_COLLECTION = 'applications';
// "In Progress" is the legacy name for what is now recorded as "In Revision".
const RESUMED_STATUSES = ['In Revision', 'In Progress'];
const RESTORE_SOURCES = ['Canceled', 'Deleted'];

const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Determines which history indices carry a duplicated, carried-over review comment.
 *
 * @param {Array<Object>} history
 * @returns {number[]} Indices whose reviewComment should be removed.
 */
function findDuplicateIndices(history) {
    if (!Array.isArray(history)) {
        return [];
    }

    const indices = [];
    for (let i = 1; i < history.length; i++) {
        const event = history[i];
        const previous = history[i - 1];
        if (!event || !previous || !RESUMED_STATUSES.includes(event.status)) {
            continue;
        }

        const comment = trimmed(event.reviewComment);
        if (!comment || comment !== trimmed(previous.reviewComment)) {
            continue;
        }
        if (RESTORE_SOURCES.includes(previous.status)) {
            continue;
        }

        indices.push(i);
    }
    return indices;
}

/**
 * @param {import('mongodb').Db} db
 * @param {{dryRun?: boolean}} [options]
 * @returns {Promise<{success: boolean, message?: string, scannedCount?: number, applicationsUpdated?: number, commentsRemoved?: number, dryRun?: boolean, error?: string}>}
 */
async function dedupeReviewComments(db, options = {}) {
    const dryRun = options.dryRun === true;
    console.log(
        `🔄 Removing duplicated review comments from ${RESUMED_STATUSES.map((s) => `"${s}"`).join('/')} history events${dryRun ? ' (DRY RUN)' : ''}...`
    );

    const collection = db.collection(APPLICATIONS_COLLECTION);

    try {
        const cursor = collection.find(
            {
                history: {
                    $elemMatch: {
                        status: { $in: RESUMED_STATUSES },
                        reviewComment: { $exists: true, $nin: [null, ''] }
                    }
                }
            },
            { projection: { history: 1 } }
        );

        let scannedCount = 0;
        let applicationsUpdated = 0;
        let commentsRemoved = 0;
        let operations = [];

        const flush = async () => {
            if (operations.length === 0) {
                return;
            }
            await collection.bulkWrite(operations, { ordered: false });
            operations = [];
        };

        while (await cursor.hasNext()) {
            const application = await cursor.next();
            scannedCount++;

            const indices = findDuplicateIndices(application.history);
            if (indices.length === 0) {
                continue;
            }

            applicationsUpdated++;
            commentsRemoved += indices.length;

            if (dryRun) {
                console.log(`   • ${application._id}: would clear history index(es) ${indices.join(', ')}`);
                continue;
            }

            const filter = { _id: application._id };
            const unset = {};
            for (const index of indices) {
                // Re-assert the exact event so a concurrent write cannot shift what we clear.
                filter[`history.${index}.status`] = application.history[index].status;
                filter[`history.${index}.reviewComment`] = application.history[index].reviewComment;
                unset[`history.${index}.reviewComment`] = '';
            }

            operations.push({ updateOne: { filter, update: { $unset: unset } } });
            if (operations.length >= 500) {
                await flush();
            }
        }

        await flush();

        console.log(
            `   ✅ Scanned ${scannedCount}, ${dryRun ? 'would update' : 'updated'} ${applicationsUpdated} application(s), ${commentsRemoved} comment(s)`
        );
        return {
            success: true,
            message: `${dryRun ? 'Would remove' : 'Removed'} ${commentsRemoved} duplicated review comment(s) across ${applicationsUpdated} application(s)`,
            scannedCount,
            applicationsUpdated,
            commentsRemoved,
            dryRun
        };
    } catch (error) {
        console.error('   ❌ Error removing duplicated review comments:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Orchestrator entry point for this migration step.
 * @param {import('mongodb').Db} db
 * @returns {Promise<Object>}
 */
async function executeDedupeReviewComments(db) {
    console.log('🔄 Executing duplicated "In Revision" review comment cleanup...');

    try {
        const result = await dedupeReviewComments(db, {
            dryRun: process.env.DEDUPE_DRY_RUN === 'true'
        });

        if (result.success) {
            console.log('✅ Duplicated review comment cleanup completed successfully');
        } else {
            console.log('❌ Duplicated review comment cleanup failed');
        }

        return result;
    } catch (error) {
        console.error('❌ Error executing duplicated review comment cleanup:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    findDuplicateIndices,
    dedupeReviewComments,
    executeDedupeReviewComments
};
