const { getCCEmails } = require('../../services/application');

describe('getCCEmails', () => {
    it('should return an empty array if the application is not found', () => {
        const result = getCCEmails(null, null);
        expect(result).toEqual([]);
    });

    it('should return an empty array if application is empty', () => {
        const result = getCCEmails(null, {});
        expect(result).toEqual([]);
    });

    it('should return an empty array if submitter email is empty', () => {
        const application = buildApplication({
            primaryContact: { email: 'test@test.com' } ,
        });
        const result = getCCEmails(null, application);
        expect(result).toEqual([]);
    });

    it('should return pi and contact email if it is not the same as the submitter email', () => {
        const application = buildApplication({
            primaryContact: { email: 'contact@test.com' },
            pi: { email: 'pi@test.com' }
        });
        const result = getCCEmails('submitter@test.com', application);
        expect(result).toHaveLength(2);
        expect(result).toEqual(expect.arrayContaining(['pi@test.com', 'contact@test.com']));
    });
    it('should not return pi email if it is the same as the submitter email', () => {
        const application = buildApplication({
            primaryContact: { email: 'contact@test.com' },
            pi: { email: 'pi@test.com' }
        });
        const result = getCCEmails('pi@test.com', application);
        expect(result).toHaveLength(1);
        expect(result).toEqual(expect.arrayContaining(['contact@test.com']));
    });

    it('should not return contact email if it is the same as the submitter email', () => {
        const application = buildApplication({
            primaryContact: { email: 'contact@test.com' },
            pi: { email: 'pi@test.com' }
        });
        const result = getCCEmails('contact@test.com', application);
        expect(result).toHaveLength(1);
        expect(result).toEqual(expect.arrayContaining(['pi@test.com']));
    });

    it('should not return either pi nor contact email if they are the same as the submitter email', () => {
        const application = buildApplication({
            primaryContact: { email: 'pi@test.com' },
            pi: { email: 'pi@test.com' }
        });
        const result = getCCEmails('pi@test.com', application);
        expect(result).toEqual([]);
    });

    it('should not return pi email if receivesEmails is false', () => {
        const application = buildApplication({
            primaryContact: { email: 'contact@test.com' },
            pi: { email: 'pi@test.com', receivesEmails: false }
        });
        const result = getCCEmails('submitter@test.com', application);
        expect(result).toHaveLength(1);
        expect(result).toEqual(expect.arrayContaining(['contact@test.com']));
    });

    it('should return pi email if receivesEmails is true', () => {
        const application = buildApplication({
            primaryContact: { email: 'contact@test.com' },
            pi: { email: 'pi@test.com', receivesEmails: true }
        });
        const result = getCCEmails('submitter@test.com', application);
        expect(result).toHaveLength(2);
        expect(result).toEqual(expect.arrayContaining(['contact@test.com', 'pi@test.com']));
    });

    it('should return additional contact emails if receivesEmails is true', () => {
        const application = buildApplication({
            additionalContacts: [
                { email: 'contact1@test.com', receivesEmails: true },
                { email: 'contact2@test.com', receivesEmails: false }
            ]
        });
        const result = getCCEmails('submitter@test.com', application);
        expect(result).toHaveLength(1);
        expect(result).toEqual(expect.arrayContaining(['contact1@test.com']));
    });

    it('should accept questionnaire data as an object', () => {
        const application = {
            questionnaireData: {
                additionalContacts: [
                    { email: 'contact1@test.com', receivesEmails: true },
                    { email: 'contact2@test.com', receivesEmails: false }
                ]
            }
        };
        const result = getCCEmails('submitter@test.com', application);
        expect(result).toHaveLength(1);
        expect(result).toEqual(expect.arrayContaining(['contact1@test.com']));
    });


});

function buildApplication(questionnaire) {
    return {
        questionnaireData: JSON.stringify(questionnaire)
    }
}