const {
    initSubmissionRequestApprovalEmailConfig,
    CONFIG_ID
} = require('../../../documentation/3-6-0/init-submission-request-approval-email-config');
const { SUBMISSION_REQUEST_APPROVAL_EMAIL_TYPE } = require('../../../utility/submission-request-approval-email-config');

describe('init-submission-request-approval-email-config migration', () => {
    let mockDb;
    let mockConfigCollection;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        mockConfigCollection = {
            updateOne: jest.fn()
        };

        mockDb = {
            collection: jest.fn(() => mockConfigCollection)
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should upsert configuration with setOnInsert', async () => {
        mockConfigCollection.updateOne.mockResolvedValue({ upsertedCount: 1 });

        const result = await initSubmissionRequestApprovalEmailConfig(mockDb);

        expect(mockDb.collection).toHaveBeenCalledWith('configuration');
        expect(mockConfigCollection.updateOne).toHaveBeenCalledWith(
            { type: SUBMISSION_REQUEST_APPROVAL_EMAIL_TYPE },
            {
                $setOnInsert: {
                    _id: CONFIG_ID,
                    type: SUBMISSION_REQUEST_APPROVAL_EMAIL_TYPE,
                    keys: expect.objectContaining({
                        APPROVE_SUBJECT: 'CRDC Submission Request Decision',
                        NOTIFICATION_SENDER: 'do-not-reply@mail.nih.gov'
                    })
                }
            },
            { upsert: true }
        );
        expect(result).toEqual({ success: true, added: true });
    });

    it('should skip when configuration already exists', async () => {
        mockConfigCollection.updateOne.mockResolvedValue({ upsertedCount: 0 });

        const result = await initSubmissionRequestApprovalEmailConfig(mockDb);

        expect(result).toEqual({ success: true, skipped: true });
    });

    it('should return success false on error', async () => {
        mockConfigCollection.updateOne.mockRejectedValue(new Error('db error'));

        const result = await initSubmissionRequestApprovalEmailConfig(mockDb);

        expect(result).toEqual({ success: false, error: 'db error' });
    });
});
