const { filterDuplicateEmails, getEmailsBasedonConditionalApproval } = require('../../services/application');
const { getPendingConditionsAtApproval } = require('../../services/approved-studies');
const PENDING_DBGAP = "submission_request:pending_dbgapid"
const PENDING_MODEL_UPDATE = "submission_request:pending_model_update"
const PENDING_IMG_DEID = "submission_request:pending_image_deidentification"

describe('filterDuplicateEmails', () => {
    it('should filter applicant email from cc emails and bcc emails', () => {
        const applicantEmail = 'applicant@test.com';
        const cCEmails = ['cc1@test.com', 'applicant@test.com'];
        const bCCEmails = ['bcc1@test.com', 'applicant@test.com'];
        const result = filterDuplicateEmails(applicantEmail, cCEmails, bCCEmails);
        expect(result).toEqual(expect.arrayContaining([['cc1@test.com'], ['bcc1@test.com']]));
    });

    it('should filter cc emails from bcc emails', () => {
        const applicantEmail = 'applicant@test.com';
        const cCEmails = ['cc1@test.com', 'applicant@test.com'];
        const bCCEmails = ['bcc1@test.com', 'cc1@test.com', 'applicant@test.com'];
        const result = filterDuplicateEmails(applicantEmail, cCEmails, bCCEmails);
        expect(result).toEqual(expect.arrayContaining([['cc1@test.com'], ['bcc1@test.com']]));
    });
});

describe('getEmailsBasedonConditionalApproval', () => {
    it('should return email for db gap missing', () => {
        const users = [
            { email: 'user1@test.com', notifications: [PENDING_DBGAP, 'other-notification'] },
            { email: 'user2@test.com', notifications: [PENDING_MODEL_UPDATE] },
            { email: 'user3@test.com', notifications: [PENDING_IMG_DEID] }
        ];
        const result = getEmailsBasedonConditionalApproval(users, true, false, false);
        expect(result).toEqual(expect.arrayContaining(['user1@test.com']));
    });

    it('should return email for pending model change', () => {
        const users = [
            { email: 'user1@test.com', notifications: [PENDING_DBGAP, 'other-notification'] },
            { email: 'user2@test.com', notifications: [PENDING_MODEL_UPDATE, 'other-notification'] },
            { email: 'user3@test.com', notifications: [PENDING_IMG_DEID, 'other-notification'] }
        ];
        const result = getEmailsBasedonConditionalApproval(users, false, true, false);
        expect(result).toEqual(expect.arrayContaining(['user2@test.com']));
    });

    it('should return email for pending image de identification', () => {
        const users = [
            { email: 'user1@test.com', notifications: [PENDING_DBGAP, 'other-notification'] },
            { email: 'user2@test.com', notifications: [PENDING_MODEL_UPDATE, 'other-notification'] },
            { email: 'user3@test.com', notifications: [PENDING_IMG_DEID, 'other-notification'] }
        ];
        const result = getEmailsBasedonConditionalApproval(users, false, false, true);
        expect(result).toEqual(expect.arrayContaining(['user3@test.com']));
    });

    it('should return all user emails that have dbgap missing', () => {
        const users = [
            { email: 'user1@test.com', notifications: [PENDING_DBGAP, 'other-notification'] },
            { email: 'user2@test.com', notifications: [PENDING_DBGAP, 'other-notification'] },
            { email: 'user3@test.com', notifications: [PENDING_IMG_DEID, 'other-notification'] }
        ];
        const result = getEmailsBasedonConditionalApproval(users, true, false, false);
        expect(result).toEqual(expect.arrayContaining(['user1@test.com', 'user2@test.com']));
    });

    it('should not return user email as long as user has one notification matching', () => {
        const users = [
            { email: 'user1@test.com', notifications: [PENDING_DBGAP, 'other-notification'] 
            },
        ];
        const result = getEmailsBasedonConditionalApproval(users, true, true, true);
        expect(result).toEqual(expect.arrayContaining(['user1@test.com']));
    });

    it('should not return user email if notification is empty', () => {
        const users = [
            { email: 'user1@test.com', notifications: [PENDING_DBGAP, 'other-notification'] 
            },
            { emails: 'user2@test.com', notifications: []}
        ];
        const result = getEmailsBasedonConditionalApproval(users, true, true, false);
        expect(result).toEqual(expect.arrayContaining(['user1@test.com']));
    });

    it('should not return user email if notification is null', () => {
        const users = [
            { email: 'user1@test.com', notifications: [PENDING_DBGAP, 'other-notification'] 
            },
            { emails: 'user2@test.com', notifications: null}
        ];
        const result = getEmailsBasedonConditionalApproval(users, true, true, false);
        expect(result).toEqual(expect.arrayContaining(['user1@test.com']));
    });

    it('should not return user email if notification is undefined', () => {
        const users = [
            { email: 'user1@test.com', notifications: [PENDING_DBGAP, 'other-notification'] 
            },
            { emails: 'user2@test.com', notifications: undefined}
        ];
        const result = getEmailsBasedonConditionalApproval(users, true, true, false);
        expect(result).toEqual(expect.arrayContaining(['user1@test.com']));
    });

    it('should not return user email if notification doesnt exist', () => {
        const users = [
            { email: 'user1@test.com', notifications: [PENDING_DBGAP, 'other-notification'] 
            },
            { emails: 'user2@test.com'}
        ];
        const result = getEmailsBasedonConditionalApproval(users, true, true, false);
        expect(result).toEqual(expect.arrayContaining(['user1@test.com']));
    });

    it('should not return user email if notification is not an array', () => {
        const users = [
            { email: 'user1@test.com', notifications: [PENDING_DBGAP, 'other-notification'] 
            },
            { emails: 'user2@test.com', notifications: 123}
        ];
        const result = getEmailsBasedonConditionalApproval(users, true, true, false);
        expect(result).toEqual(expect.arrayContaining(['user1@test.com']));
    });

});

describe('getPendingConditionsAtApproval', () => {
    it('should return empty array if not pending conditions', () => {
        const approvedStudy = {
            controlledAccess: false,
            dbGaPID: 'phs000007',
            pendingModelChange: false,
            pendingImageDeIdentification: false
        };
        const result = getPendingConditionsAtApproval(approvedStudy);
        expect(result).toEqual([]);
    });

    it('should return submission_request:pending_image_deidentification if pending image deidentification is true', () => {
        const approvedStudy = {
            controlledAccess: false,
            dbGaPID: 'phs000007',
            pendingModelChange: false,
            pendingImageDeIdentification: true
        };
        const result = getPendingConditionsAtApproval(approvedStudy);
        expect(result).toEqual(['submission_request:pending_image_deidentification']);
    });

    it('should return submission_request:pending_model_update if pending model update is true', () => {
        const approvedStudy = {
            controlledAccess: false,
            dbGaPID: 'phs000007',
            pendingModelChange: true,
            pendingImageDeIdentification: false
        };
        const result = getPendingConditionsAtApproval(approvedStudy);
        expect(result).toEqual(['submission_request:pending_model_update']);
    });

    it('should return submission_request:pending_dbgapid if pending dbgapid is true', () => {
        const approvedStudy = {
            controlledAccess: true,
            dbGaPID: null,
            pendingModelChange: false,
            pendingImageDeIdentification: false
        };
        const result = getPendingConditionsAtApproval(approvedStudy);
        expect(result).toEqual(['submission_request:pending_dbgapid']);
    });

    it('should return array of pending condidtions when multiple pending conditions are true', () => {
        const approvedStudy = {
            controlledAccess: true,
            dbGaPID: null,
            pendingModelChange: true,
            pendingImageDeIdentification: true
        };
        const result = getPendingConditionsAtApproval(approvedStudy);
        expect(result).toEqual(['submission_request:pending_dbgapid', 'submission_request:pending_model_update', 'submission_request:pending_image_deidentification']);
    });

    it('should treat null or undefined as false', () => {
        const approvedStudy = {
            controlledAccess: true,
            dbGaPID: null,
            pendingModelChange: null,
            pendingImageDeIdentification: undefined
        };
        const result = getPendingConditionsAtApproval(approvedStudy);
        expect(result).toEqual(['submission_request:pending_dbgapid']);
    });
});