const { filterDuplicateEmails, getEmailsBasedonConditionalApproval } = require('../../services/application');
const {EMAIL_NOTIFICATIONS} = require("../../crdc-datahub-database-drivers/constants/user-permission-constants");

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
            { email: 'user1@test.com', notifications: [EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_DB_GAP_MISSING, 'other-notification'] },
            { email: 'user2@test.com', notifications: [EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_MODEL_CHANGE] },
            { email: 'user3@test.com', notifications: [EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_IMAGE_DE_IDENTIFICATION] }
        ];
        const result = getEmailsBasedonConditionalApproval(users, true, false, false);
        expect(result).toEqual(expect.arrayContaining(['user1@test.com']));
    });

    it('should return email for pending model change', () => {
        const users = [
            { email: 'user1@test.com', notifications: [EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_DB_GAP_MISSING, 'other-notification'] },
            { email: 'user2@test.com', notifications: [EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_MODEL_CHANGE, 'other-notification'] },
            { email: 'user3@test.com', notifications: [EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_IMAGE_DE_IDENTIFICATION, 'other-notification'] }
        ];
        const result = getEmailsBasedonConditionalApproval(users, false, true, false);
        expect(result).toEqual(expect.arrayContaining(['user2@test.com']));
    });

    it('should return email for pending image de identification', () => {
        const users = [
            { email: 'user1@test.com', notifications: [EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_DB_GAP_MISSING, 'other-notification'] },
            { email: 'user2@test.com', notifications: [EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_MODEL_CHANGE, 'other-notification'] },
            { email: 'user3@test.com', notifications: [EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_IMAGE_DE_IDENTIFICATION, 'other-notification'] }
        ];
        const result = getEmailsBasedonConditionalApproval(users, false, false, true);
        expect(result).toEqual(expect.arrayContaining(['user3@test.com']));
    });

    it('should return all user emails that have dbgap missing', () => {
        const users = [
            { email: 'user1@test.com', notifications: [EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_DB_GAP_MISSING, 'other-notification'] },
            { email: 'user2@test.com', notifications: [EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_DB_GAP_MISSING, 'other-notification'] },
            { email: 'user3@test.com', notifications: [EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_IMAGE_DE_IDENTIFICATION, 'other-notification'] }
        ];
        const result = getEmailsBasedonConditionalApproval(users, true, false, false);
        expect(result).toEqual(expect.arrayContaining(['user1@test.com', 'user2@test.com']));
    });

    it('should not return user email as long as user has one notification matching', () => {
        const users = [
            { email: 'user1@test.com', notifications: [EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_DB_GAP_MISSING, 'other-notification'] 
            },
        ];
        const result = getEmailsBasedonConditionalApproval(users, true, true, true);
        expect(result).toEqual(expect.arrayContaining(['user1@test.com']));
    });

    it('should not return user email if notification is empty', () => {
        const users = [
            { email: 'user1@test.com', notifications: [EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_DB_GAP_MISSING, 'other-notification'] 
            },
            { emails: 'user2@test.com', notifications: []}
        ];
        const result = getEmailsBasedonConditionalApproval(users, true, true, false);
        expect(result).toEqual(expect.arrayContaining(['user1@test.com']));
    });

    it('should not return user email if notification is null', () => {
        const users = [
            { email: 'user1@test.com', notifications: [EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_DB_GAP_MISSING, 'other-notification'] 
            },
            { emails: 'user2@test.com', notifications: null}
        ];
        const result = getEmailsBasedonConditionalApproval(users, true, true, false);
        expect(result).toEqual(expect.arrayContaining(['user1@test.com']));
    });

    it('should not return user email if notification is undefined', () => {
        const users = [
            { email: 'user1@test.com', notifications: [EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_DB_GAP_MISSING, 'other-notification'] 
            },
            { emails: 'user2@test.com', notifications: undefined}
        ];
        const result = getEmailsBasedonConditionalApproval(users, true, true, false);
        expect(result).toEqual(expect.arrayContaining(['user1@test.com']));
    });

    it('should not return user email if notification doesnt exist', () => {
        const users = [
            { email: 'user1@test.com', notifications: [EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_DB_GAP_MISSING, 'other-notification'] 
            },
            { emails: 'user2@test.com'}
        ];
        const result = getEmailsBasedonConditionalApproval(users, true, true, false);
        expect(result).toEqual(expect.arrayContaining(['user1@test.com']));
    });

    it('should not return user email if notification is not an array', () => {
        const users = [
            { email: 'user1@test.com', notifications: [EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_DB_GAP_MISSING, 'other-notification'] 
            },
            { emails: 'user2@test.com', notifications: 123}
        ];
        const result = getEmailsBasedonConditionalApproval(users, true, true, false);
        expect(result).toEqual(expect.arrayContaining(['user1@test.com']));
    });

});