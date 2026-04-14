const {
    SUBMISSION_REQUEST_APPROVAL_EMAIL_TYPE,
    SUBMISSION_REQUEST_APPROVAL_EMAIL_KEYS,
    mergeSubmissionRequestApprovalEmailConstants,
    confirmAllConstantsAreInitialized,
    pickSubmissionRequestApprovalKeysFromYaml
} = require('../../utility/submission-request-approval-email-config');

describe('submission-request-approval-email-config', () => {
    const yaml = {
        NOTIFICATION_SENDER: 'yaml-sender@nih.gov',
        APPROVE_SUBJECT: 'YAML Subject',
        APPROVE_CONTENT: 'YAML content $study',
        APPROVE_SECOND_CONTENT: 'second',
        APPROVE_THIRD_CONTENT: 'third',
        SINGLE_PENDING_PENDING_TOP_MESSAGE: 'top',
        MISSING_DBGAP_PENDING_CHANGE: 'dbgap',
        DATA_MODEL_PENDING_CHANGE: 'model',
        CONDITIONAL_PENDING_MULTIPLE_CHANGES: 'multi top',
        MISSING_DBGAP_PENDING_CHANGE_MULTIPLE: 'dbgap multi',
        MISSING_GPA_INFO: 'gpa',
        IMAGE_DEIDENTIFICATION_PENDING_TOP_MESSAGE: 'img top',
        PENDING_IMAGE_DEIDENTIFICATION_APPROVE_EMAIL: 'img body',
        PENDING_IMAGE_DEIDENTIFICATION_APPROVE_EMAIL_MULTIPLE: 'img multi'
    };

    it('exports stable config type and key list', () => {
        expect(SUBMISSION_REQUEST_APPROVAL_EMAIL_TYPE).toBe('SUBMISSION_REQUEST_APPROVAL_EMAIL');
        expect(SUBMISSION_REQUEST_APPROVAL_EMAIL_KEYS).toContain('APPROVE_SUBJECT');
        expect(SUBMISSION_REQUEST_APPROVAL_EMAIL_KEYS).toContain('NOTIFICATION_SENDER');
    });

    it('merge uses YAML when DB missing', () => {
        const merged = mergeSubmissionRequestApprovalEmailConstants(yaml, null);
        expect(merged.APPROVE_SUBJECT).toBe('YAML Subject');
        expect(merged.NOTIFICATION_SENDER).toBe('yaml-sender@nih.gov');
    });

    it('merge prefers non-empty DB string over YAML', () => {
        const merged = mergeSubmissionRequestApprovalEmailConstants(yaml, {
            keys: { APPROVE_SUBJECT: 'DB Subject', APPROVE_CONTENT: '   ' }
        });
        expect(merged.APPROVE_SUBJECT).toBe('DB Subject');
        expect(merged.APPROVE_CONTENT).toBe('YAML content $study');
    });

    it('pickSubmissionRequestApprovalKeysFromYaml matches merge with null doc', () => {
        expect(pickSubmissionRequestApprovalKeysFromYaml(yaml)).toEqual(
            mergeSubmissionRequestApprovalEmailConstants(yaml, null)
        );
    });

    it('confirmAllConstantsAreInitialized backfills from YAML when merged value empty', () => {
        const merged = mergeSubmissionRequestApprovalEmailConstants(yaml, {
            keys: { APPROVE_CONTENT: 'DB body' }
        });
        merged.APPROVE_SUBJECT = '   ';
        const ensured = confirmAllConstantsAreInitialized(merged, yaml);
        expect(ensured.APPROVE_SUBJECT).toBe('YAML Subject');
        expect(ensured.APPROVE_CONTENT).toBe('DB body');
        expect(typeof ensured.NOTIFICATION_SENDER).toBe('string');
    });

    it('confirmAllConstantsAreInitialized logs and uses empty string when key missing everywhere', () => {
        const sparseYaml = { ...yaml };
        delete sparseYaml.APPROVE_SUBJECT;
        const merged = mergeSubmissionRequestApprovalEmailConstants(sparseYaml, null);
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const ensured = confirmAllConstantsAreInitialized(merged, sparseYaml);
        expect(ensured.APPROVE_SUBJECT).toBe('');
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('APPROVE_SUBJECT')
        );
        console.error.mockRestore();
    });
});
