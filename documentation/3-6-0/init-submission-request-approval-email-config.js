/**
 * Migration: Initialize SUBMISSION_REQUEST_APPROVAL_EMAIL configuration
 *
 * Inserts configuration with type SUBMISSION_REQUEST_APPROVAL_EMAIL and keys
 * seeded from resources/yaml/notification_email_values.yaml if missing ($setOnInsert).
 *
 * Usage: Called by the 3.6.0 migration orchestrator
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const {
    SUBMISSION_REQUEST_APPROVAL_EMAIL_TYPE,
    pickSubmissionRequestApprovalKeysFromYaml
} = require('../../utility/submission-request-approval-email-config');

const CONFIGURATION_COLLECTION = 'configuration';
const CONFIG_ID = 'b7e3f1a2-4c5d-6e7f-8a9b-0c1d2e3f4a5b';

function loadYamlEmailConstants() {
    const yamlPath = path.join(__dirname, '../../resources/yaml/notification_email_values.yaml');
    const raw = fs.readFileSync(yamlPath, 'utf8');
    return yaml.load(raw);
}

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, added?: boolean, skipped?: boolean, error?: string}>}
 */
async function initSubmissionRequestApprovalEmailConfig(db) {
    console.log('🔄 Adding SUBMISSION_REQUEST_APPROVAL_EMAIL configuration...');

    const configCollection = db.collection(CONFIGURATION_COLLECTION);

    try {
        const yamlConstants = loadYamlEmailConstants();
        const keys = pickSubmissionRequestApprovalKeysFromYaml(yamlConstants);

        const upsertResult = await configCollection.updateOne(
            { type: SUBMISSION_REQUEST_APPROVAL_EMAIL_TYPE },
            {
                $setOnInsert: {
                    _id: CONFIG_ID,
                    type: SUBMISSION_REQUEST_APPROVAL_EMAIL_TYPE,
                    keys
                }
            },
            { upsert: true }
        );

        if (upsertResult.upsertedCount > 0) {
            console.log(`   ✅ Inserted ${SUBMISSION_REQUEST_APPROVAL_EMAIL_TYPE} configuration`);
            return { success: true, added: true };
        }
        console.log(`   ℹ️  ${SUBMISSION_REQUEST_APPROVAL_EMAIL_TYPE} configuration already exists, skipping`);
        return { success: true, skipped: true };
    } catch (error) {
        console.error(`   ❌ Error adding ${SUBMISSION_REQUEST_APPROVAL_EMAIL_TYPE} configuration:`, error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    initSubmissionRequestApprovalEmailConfig,
    CONFIG_ID,
    loadYamlEmailConstants
};
