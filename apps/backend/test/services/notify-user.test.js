jest.mock('../../lib/create-email-template', () => ({
    createEmailTemplate: jest.fn().mockResolvedValue('<p>ok</p>')
}));

const { createEmailTemplate } = require('../../lib/create-email-template');
const { NotifyUser } = require('../../services/notify-user');

describe('NotifyUser', () => {
    let notify;
    let emailService;
    beforeEach(() => {
        jest.clearAllMocks();
        emailService = { sendNotification: jest.fn().mockResolvedValue({ accepted: ['x@y'] }) };
        notify = new NotifyUser(emailService, null);
    });

    describe('inquireQuestionNotification', () => {
        it('uses notification-template-sr-inquire and passes study fields and message parts', async () => {
            await notify.inquireQuestionNotification(
                'submitter@example.org',
                ['cc@example.org'],
                ['bcc@example.org'],
                {
                    firstName: 'Pat',
                    reviewComments: 'Please clarify X.',
                    studyName: 'My Study',
                    studyAbbreviation: 'MS',
                },
                {}
            );
            expect(createEmailTemplate).toHaveBeenCalledWith(
                'notification-template-sr-inquire.html',
                expect.objectContaining({
                    firstName: 'Pat',
                    reviewComments: 'Please clarify X.',
                    studyName: 'My Study',
                    studyAbbreviation: 'MS',
                    message: expect.stringContaining('for the study listed below'),
                    secondMessage: expect.stringContaining('A separate email with detailed questions'),
                    thirdMessage: 'Let us know if you have any questions.',
                })
            );
        });

        it('passes through NA display values for study fields from the caller', async () => {
            await notify.inquireQuestionNotification(
                'a@a',
                [],
                [],
                {
                    firstName: 'Q',
                    reviewComments: 'C',
                    studyName: 'NA',
                    studyAbbreviation: 'NA',
                },
                {}
            );
            expect(createEmailTemplate).toHaveBeenCalledWith(
                'notification-template-sr-inquire.html',
                expect.objectContaining({ studyName: 'NA', studyAbbreviation: 'NA' })
            );
        });
    });

    describe('multipleChangesApproveQuestionNotification', () => {
        it('passes isMultiplePendingConditions true and includes each pending snippet when all flags are set', async () => {
            await notify.multipleChangesApproveQuestionNotification(
                'submitter@example.org',
                ['cc@example.org'],
                ['bcc@example.org'],
                {
                    firstName: 'Pat',
                    study: 'My Study',
                    reviewComments: 'See comments.',
                    contactEmail: 'helpdesk@nih.gov',
                    submissionGuideURL: 'https://example.org/guide'
                },
                true,
                true,
                true,
                true
            );
            expect(createEmailTemplate).toHaveBeenCalledWith(
                'notification-template-SR-pending-conditions.html',
                expect.objectContaining({
                    isMultiplePendingConditions: true,
                    omitSubmissionGuideInFooter: true
                })
            );
            const srCall = createEmailTemplate.mock.calls.find(
                (c) => c[0] === 'notification-template-SR-pending-conditions.html'
            );
            expect(srCall[1].pendingConditions).toHaveLength(4);
            const combined = srCall[1].pendingConditions.join(' ');
            expect(combined).toContain('grants.nih.gov');
            expect(combined).toMatch(/CRDC data model/i);
            expect(combined).toMatch(/GPA/i);
            expect(combined).toContain('docs.google.com');
        });

        it('sets omitSubmissionGuideInFooter false when imaging is not among pendings', async () => {
            await notify.multipleChangesApproveQuestionNotification(
                'submitter@example.org',
                [],
                [],
                {
                    firstName: 'Pat',
                    study: 'My Study',
                    reviewComments: 'N/A',
                    contactEmail: 'helpdesk@nih.gov',
                    submissionGuideURL: 'https://example.org/guide'
                },
                true,
                true,
                false,
                false
            );
            expect(createEmailTemplate).toHaveBeenCalledWith(
                'notification-template-SR-pending-conditions.html',
                expect.objectContaining({
                    isMultiplePendingConditions: true,
                    omitSubmissionGuideInFooter: false
                })
            );
        });
    });

    describe('dataModelChangeApproveQuestionNotification', () => {
        it('omits Data Submission Instructions in footer per 3.6.0 conditional-approve DM template', async () => {
            await notify.dataModelChangeApproveQuestionNotification(
                'submitter@example.org',
                [],
                [],
                {
                    firstName: 'Pat',
                    study: 'My Study',
                    reviewComments: 'N/A',
                    contactEmail: 'helpdesk@nih.gov',
                    submissionGuideURL: 'https://example.org/guide'
                }
            );
            expect(createEmailTemplate).toHaveBeenCalledWith(
                'notification-template-SR-pending-conditions.html',
                expect.objectContaining({
                    omitDataSubmissionInstructionsOnly: true,
                    isMultiplePendingConditions: false
                })
            );
        });
    });

    describe('dbGapMissingApproveQuestionNotification', () => {
        it('passes isMultiplePendingConditions false for single-pending template', async () => {
            await notify.dbGapMissingApproveQuestionNotification(
                'submitter@example.org',
                [],
                [],
                {
                    firstName: 'Pat',
                    study: 'My Study',
                    reviewComments: 'N/A',
                    contactEmail: 'helpdesk@nih.gov',
                    submissionGuideURL: 'https://example.org/guide'
                }
            );
            expect(createEmailTemplate).toHaveBeenCalledWith(
                'notification-template-SR-pending-conditions.html',
                expect.objectContaining({ isMultiplePendingConditions: false })
            );
        });
    });

    describe('reopenSubmissionRequestNotification', () => {
        it('uses notification-template-sr-reopen and passes study and program fields', async () => {
            await notify.reopenSubmissionRequestNotification(
                'owner@example.org',
                ['cc@example.org'],
                ['bcc@example.org'],
                {
                    firstName: 'Jane Doe',
                    isOwnershipChanged: false,
                },
                {
                    studyName: 'My Study',
                    studyAbbreviation: 'MS',
                    programName: 'My Program',
                    programAbbreviation: 'MP',
                    contactEmail: 'helpdesk@nih.gov.',
                }
            );
            expect(createEmailTemplate).toHaveBeenCalledWith(
                'notification-template-sr-reopen.html',
                expect.objectContaining({
                    firstName: 'Jane Doe',
                    studyName: 'My Study',
                    studyAbbreviation: 'MS',
                    programName: 'My Program',
                    programAbbreviation: 'MP',
                    isOwnershipChanged: false,
                })
            );
        });

        it('passes isOwnershipChanged true when ownership changed', async () => {
            await notify.reopenSubmissionRequestNotification(
                'owner@example.org',
                [],
                [],
                {
                    firstName: 'New Owner',
                    isOwnershipChanged: true,
                },
                {
                    studyName: 'Study',
                    studyAbbreviation: 'S',
                    programName: 'Prog',
                    programAbbreviation: 'P',
                    contactEmail: 'help@test.gov.',
                }
            );
            expect(createEmailTemplate).toHaveBeenCalledWith(
                'notification-template-sr-reopen.html',
                expect.objectContaining({
                    isOwnershipChanged: true,
                })
            );
        });

        it('passes through NA display values for study fields from the caller', async () => {
            await notify.reopenSubmissionRequestNotification(
                'a@a',
                [],
                [],
                { firstName: 'Q', isOwnershipChanged: false },
                {
                    studyName: 'NA',
                    studyAbbreviation: 'NA',
                    programName: 'NA',
                    programAbbreviation: 'NA',
                    contactEmail: 'help@test.gov.',
                }
            );
            expect(createEmailTemplate).toHaveBeenCalledWith(
                'notification-template-sr-reopen.html',
                expect.objectContaining({
                    studyName: 'NA',
                    studyAbbreviation: 'NA',
                    programName: 'NA',
                    programAbbreviation: 'NA',
                })
            );
        });

        it('includes message content derived from email constants', async () => {
            await notify.reopenSubmissionRequestNotification(
                'owner@example.org',
                [],
                [],
                { firstName: 'Pat', isOwnershipChanged: false },
                {
                    studyName: 'Study',
                    studyAbbreviation: 'S',
                    programName: 'Prog',
                    programAbbreviation: 'P',
                    contactEmail: 'help@test.gov.',
                }
            );
            const templateCall = createEmailTemplate.mock.calls.find(
                (c) => c[0] === 'notification-template-sr-reopen.html'
            );
            expect(templateCall[1].message).toBeDefined();
            expect(templateCall[1].secondMessage).toBeDefined();
            expect(templateCall[1].thirdMessage).toBeDefined();
            expect(templateCall[1].thirdMessage).toContain('help@test.gov.');
        });
    });
});
