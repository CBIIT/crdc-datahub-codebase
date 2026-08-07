const SubmissionRequestDAO = require('../../dao/submission-request');
const MongooseGenericDAO = require('../../dao/mongoose-generic');
const { toSubmissionRequestUpdateData } = require('../../dao/submission-request');

describe('toSubmissionRequestUpdateData', () => {
    it('strips hydrated and computed fields but keeps applicantID', () => {
        const input = {
            _id: 'app-1',
            id: 'app-1',
            applicantID: 'user-1',
            applicant: { applicantID: 'user-1', applicantName: 'Test User' },
            canBeReopened: false,
            canBeRestored: false,
            conditional: true,
            pendingConditions: ['pending'],
            institution: { name: 'Legacy' },
            status: 'In Progress',
            studyName: 'Study',
        };

        expect(toSubmissionRequestUpdateData(input)).toEqual({
            applicantID: 'user-1',
            status: 'In Progress',
            studyName: 'Study',
        });
    });

    it('preserves persistable scalar and nested fields', () => {
        const history = [{ status: 'New', userID: 'user-1', dateTime: new Date() }];
        const input = {
            _id: 'app-1',
            status: 'In Progress',
            history,
            nextRevisionId: 'rev-2',
            inactiveReminder: false,
            questionnaireData: '{}',
        };

        expect(toSubmissionRequestUpdateData(input)).toEqual({
            status: 'In Progress',
            history,
            nextRevisionId: 'rev-2',
            inactiveReminder: false,
            questionnaireData: '{}',
        });
    });
});

describe('SubmissionRequestDAO.update', () => {
    let dao;
    let superUpdate;

    beforeEach(() => {
        dao = new SubmissionRequestDAO();
        superUpdate = jest.spyOn(MongooseGenericDAO.prototype, 'update').mockResolvedValue({ id: 'app-1', _id: 'app-1' });
    });

    afterEach(() => {
        superUpdate.mockRestore();
    });

    it('passes sanitized data to MongooseGenericDAO.update', async () => {
        const payload = {
            _id: '9d2037ab-351e-4429-8b83-08771bb4c0da',
            applicantID: 'aee27fd7-e064-4650-b856-ca58f26684e9',
            applicant: {
                applicantID: 'aee27fd7-e064-4650-b856-ca58f26684e9',
                applicantName: 'Test User',
            },
            canBeReopened: false,
            canBeRestored: false,
            conditional: true,
            pendingConditions: [],
            status: 'In Progress',
            studyName: 'Reopen SRF Test',
            history: [{ status: 'In Progress', userID: 'aee27fd7-e064-4650-b856-ca58f26684e9' }],
        };

        await dao.update(payload);

        expect(superUpdate).toHaveBeenCalledWith(
            '9d2037ab-351e-4429-8b83-08771bb4c0da',
            {
                applicantID: 'aee27fd7-e064-4650-b856-ca58f26684e9',
                status: 'In Progress',
                studyName: 'Reopen SRF Test',
                history: payload.history,
            }
        );
    });

    it('uses id when _id is absent', async () => {
        await dao.update({ id: 'app-by-id', status: 'Submitted' });

        expect(superUpdate).toHaveBeenCalledWith('app-by-id', { status: 'Submitted' });
    });

    it('throws when neither _id nor id is present', async () => {
        await expect(dao.update({ status: 'New' })).rejects.toThrow('Submission request must have an _id or id');
        expect(superUpdate).not.toHaveBeenCalled();
    });
});
