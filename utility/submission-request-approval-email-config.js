/**
 * Submission request approval emails: DB-backed copy merged over YAML defaults.
 * Keys match {@link resources/yaml/notification_email_values.yaml}.
 */
const SUBMISSION_REQUEST_APPROVAL_EMAIL_TYPE = 'SUBMISSION_REQUEST_APPROVAL_EMAIL';

/** YAML keys read by SR approval notification methods in notify-user.js */
const SUBMISSION_REQUEST_APPROVAL_EMAIL_KEYS = [
    'NOTIFICATION_SENDER',
    'APPROVE_SUBJECT',
    'APPROVE_CONTENT',
    'APPROVE_SECOND_CONTENT',
    'APPROVE_THIRD_CONTENT',
    'SINGLE_PENDING_PENDING_TOP_MESSAGE',
    'MISSING_DBGAP_PENDING_CHANGE',
    'DATA_MODEL_PENDING_CHANGE',
    'CONDITIONAL_PENDING_MULTIPLE_CHANGES',
    'MISSING_DBGAP_PENDING_CHANGE_MULTIPLE',
    'MISSING_GPA_INFO',
    'IMAGE_DEIDENTIFICATION_PENDING_TOP_MESSAGE',
    'PENDING_IMAGE_DEIDENTIFICATION_APPROVE_EMAIL',
    'PENDING_IMAGE_DEIDENTIFICATION_APPROVE_EMAIL_MULTIPLE'
];

/**
 * @param {Record<string, unknown>|null|undefined} yamlConstants - full email_constants from YAML
 * @param {{ keys?: Record<string, string> }|null|undefined} configDoc - configuration document from DB
 * @returns {Record<string, string|undefined>}
 */
function mergeSubmissionRequestApprovalEmailConstants(yamlConstants, configDoc) {
    const dbKeys = configDoc?.keys && typeof configDoc.keys === 'object' ? configDoc.keys : {};
    const out = {};
    for (const key of SUBMISSION_REQUEST_APPROVAL_EMAIL_KEYS) {
        const fromDb = dbKeys[key];
        const useDb = fromDb != null && String(fromDb).trim() !== '';
        out[key] = useDb ? String(fromDb) : yamlConstants?.[key];
    }
    return out;
}

/**
 * After DB/YAML merge: every known key must be a non-empty string for safe template use.
 * Fills gaps from YAML when merged value is missing or whitespace-only; logs if still absent.
 *
 * @param {Record<string, unknown>|null|undefined} merged
 * @param {Record<string, unknown>|null|undefined} yamlConstants
 * @returns {Record<string, string>}
 */
function confirmAllConstantsAreInitialized(merged, yamlConstants) {
    const out = {};
    for (const key of SUBMISSION_REQUEST_APPROVAL_EMAIL_KEYS) {
        let value = merged?.[key];
        if ((value == null) || (typeof value === 'string' && value.trim() === '')) {
            const fromYaml = yamlConstants?.[key];
            if (fromYaml != null && String(fromYaml).trim() !== '') {
                value = String(fromYaml);
            } else {
                console.error(
                    `Submission request approval email: missing or empty constant "${key}" after DB/YAML merge; email body may be incomplete.`
                );
                value = '';
            }
        } else {
            value = String(value);
        }
        out[key] = value;
    }
    return out;
}

/**
 * @param {Record<string, unknown>} yamlConstants
 * @returns {Record<string, string|undefined>}
 */
function pickSubmissionRequestApprovalKeysFromYaml(yamlConstants) {
    return mergeSubmissionRequestApprovalEmailConstants(yamlConstants, null);
}

module.exports = {
    SUBMISSION_REQUEST_APPROVAL_EMAIL_TYPE,
    SUBMISSION_REQUEST_APPROVAL_EMAIL_KEYS,
    mergeSubmissionRequestApprovalEmailConstants,
    confirmAllConstantsAreInitialized,
    pickSubmissionRequestApprovalKeysFromYaml
};
