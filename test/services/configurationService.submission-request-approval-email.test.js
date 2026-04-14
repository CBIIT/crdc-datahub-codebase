const { ConfigurationService } = require('../../services/configurationService');

describe('ConfigurationService.getSubmissionRequestApprovalEmailConstants', () => {
    let configurationService;

    const yamlConstants = {
        APPROVE_SUBJECT: 'From YAML',
        APPROVE_CONTENT: 'Body',
        APPROVE_SECOND_CONTENT: 's2',
        APPROVE_THIRD_CONTENT: 's3',
        NOTIFICATION_SENDER: 'sender@yaml',
        SINGLE_PENDING_PENDING_TOP_MESSAGE: 'top',
        MISSING_DBGAP_PENDING_CHANGE: 'd1',
        DATA_MODEL_PENDING_CHANGE: 'dm',
        CONDITIONAL_PENDING_MULTIPLE_CHANGES: 'c1',
        MISSING_DBGAP_PENDING_CHANGE_MULTIPLE: 'd2',
        MISSING_GPA_INFO: 'gpa',
        IMAGE_DEIDENTIFICATION_PENDING_TOP_MESSAGE: 'i-top',
        PENDING_IMAGE_DEIDENTIFICATION_APPROVE_EMAIL: 'i-body',
        PENDING_IMAGE_DEIDENTIFICATION_APPROVE_EMAIL_MULTIPLE: 'i-multi'
    };

    beforeEach(() => {
        configurationService = new ConfigurationService();
        jest.spyOn(configurationService.configurationDAO, 'findByType').mockResolvedValue(null);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns YAML defaults when no configuration document', async () => {
        const merged = await configurationService.getSubmissionRequestApprovalEmailConstants(yamlConstants);
        expect(merged.APPROVE_SUBJECT).toBe('From YAML');
        expect(configurationService.configurationDAO.findByType).toHaveBeenCalledWith(
            'SUBMISSION_REQUEST_APPROVAL_EMAIL'
        );
    });

    it('overrides with DB keys when document present', async () => {
        configurationService.configurationDAO.findByType.mockResolvedValue({
            type: 'SUBMISSION_REQUEST_APPROVAL_EMAIL',
            keys: { APPROVE_SUBJECT: 'From DB' }
        });

        const merged = await configurationService.getSubmissionRequestApprovalEmailConstants(yamlConstants);
        expect(merged.APPROVE_SUBJECT).toBe('From DB');
        expect(merged.APPROVE_CONTENT).toBe('Body');
    });
});
