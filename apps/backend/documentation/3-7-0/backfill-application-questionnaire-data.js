/**
 * Migration: Convert Application.questionnaireData from JSON string to object where stored as string
 *
 * Reads applications whose questionnaireData is a BSON string, parses JSON, and persists the object.
 * Documents that already store questionnaireData as an object are not modified.
 *
 * Idempotent: safe to run multiple times.
 *
 * Usage: Called by the 3.7.0 migration orchestrator
 */

const APPLICATIONS_COLLECTION = 'applications';

const STRING_QUESTIONNAIRE_DATA_FILTER = {
    questionnaireData: { $type: 'string' }
};

const QUESTIONNAIRE_DATA_PROJECTION = {
    questionnaireData: 1
};

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, matchedCount?: number, modifiedCount?: number, parseErrorCount?: number, error?: string}>}
 */
async function backfillApplicationQuestionnaireData(db) {
    console.log('🔄 Backfilling Application.questionnaireData (string → object)...');

    const collection = db.collection(APPLICATIONS_COLLECTION);

    try {
        const applications = await collection
            .find(STRING_QUESTIONNAIRE_DATA_FILTER, { projection: QUESTIONNAIRE_DATA_PROJECTION })
            .toArray();

        if (applications.length === 0) {
            console.log('   ✅ No applications require questionnaireData conversion');
            return {
                success: true,
                message: 'No applications required questionnaireData conversion',
                matchedCount: 0,
                modifiedCount: 0,
                parseErrorCount: 0
            };
        }

        const operations = [];
        let parseErrorCount = 0;

        for (const application of applications) {
            let parsed;
            try {
                parsed = JSON.parse(application.questionnaireData);
            } catch (parseError) {
                parseErrorCount += 1;
                console.error(
                    `   ❌ Failed to parse questionnaireData for application ${application._id}: ${parseError.message}`
                );
                continue;
            }

            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                parseErrorCount += 1;
                console.error(
                    `   ❌ questionnaireData for application ${application._id} did not parse to a plain object; skipping`
                );
                continue;
            }

            operations.push({
                updateOne: {
                    filter: {
                        _id: application._id,
                        ...STRING_QUESTIONNAIRE_DATA_FILTER
                    },
                    update: {
                        $set: {
                            questionnaireData: parsed
                        }
                    }
                }
            });
        }

        if (operations.length === 0) {
            console.log(`   ⚠️  No updates applied (${parseErrorCount} parse error(s))`);
            return {
                success: parseErrorCount === 0,
                message: parseErrorCount > 0
                    ? `No applications updated; ${parseErrorCount} questionnaireData value(s) could not be parsed`
                    : 'No applications required questionnaireData conversion',
                matchedCount: applications.length,
                modifiedCount: 0,
                parseErrorCount,
                ...(parseErrorCount > 0 ? { error: 'One or more questionnaireData values failed to parse' } : {})
            };
        }

        const result = await collection.bulkWrite(operations, { ordered: false });
        const matchedCount = result.matchedCount ?? 0;
        const modifiedCount = result.modifiedCount ?? 0;

        console.log(
            `   ✅ Matched ${matchedCount}, modified ${modifiedCount}${parseErrorCount > 0 ? ` (${parseErrorCount} parse error(s))` : ''}`
        );
        return {
            success: parseErrorCount === 0,
            message: `Converted questionnaireData to object on ${modifiedCount} application document(s)`,
            matchedCount,
            modifiedCount,
            parseErrorCount,
            ...(parseErrorCount > 0 ? { error: 'One or more questionnaireData values failed to parse' } : {})
        };
    } catch (error) {
        console.error('   ❌ Error backfilling Application.questionnaireData:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Orchestrator entry point for this migration step.
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, matchedCount?: number, modifiedCount?: number, parseErrorCount?: number, error?: string}>}
 */
async function executeBackfillApplicationQuestionnaireData(db) {
    console.log('🔄 Executing Application.questionnaireData backfill...');

    try {
        const result = await backfillApplicationQuestionnaireData(db);

        if (result.success) {
            console.log('✅ Application.questionnaireData backfill completed successfully');
        } else {
            console.log('❌ Application.questionnaireData backfill failed');
        }

        return result;
    } catch (error) {
        console.error('❌ Error executing Application.questionnaireData backfill:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    backfillApplicationQuestionnaireData,
    executeBackfillApplicationQuestionnaireData
};
