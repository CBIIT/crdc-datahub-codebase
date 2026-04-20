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
});
