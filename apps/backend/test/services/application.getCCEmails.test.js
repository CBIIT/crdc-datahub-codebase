const { getCCEmails } = require('../../services/application');

describe('getCCEmails', () => {
    it('should return an empty array if the application is not set', () => {
        const result = getCCEmails(null, null);
        expect(result).toEqual([]);
    });

    it('should return an empty array if application is empty', () => {
        const result = getCCEmails(null, {});
        expect(result).toEqual([]);
    });

    it('should return an empty array if submitter email is empty', () => {
        const application = buildApplication({
            pi: { email: 'test@test.com' } ,
        });
        const result = getCCEmails(null, application);
        expect(result).toEqual([]);
    });

    it('should return primay contact email if legacy data and primary contact is set', () => {
        const application = buildApplication({
            pi: { email: 'pi@test.com' } ,
            primaryContact: { email: 'contact@test.com' },
        });
        const result = getCCEmails('submitter@test.com', application);
        expect(result).toHaveLength(1);
        expect(result).toEqual(expect.arrayContaining(['contact@test.com']));
    });

    it('should not return contact email if legacy data and primary contact email is the same as the submitter email', () => {
        const application = buildApplication({
            pi: { email: 'pi@test.com' } ,
            primaryContact: { email: 'contact@test.com' },
        });
        const result = getCCEmails('contact@test.com', application);
        expect(result).toHaveLength(0);
        expect(result).toEqual([]);
    });

    it('should return pi email if legacy data and PI is set as primary contact', () => {
        const application = buildApplication({
            piAsPrimaryContact: true,
            pi: { email: 'pi@test.com' }
        });
        const result = getCCEmails('submitter@test.com', application);
        expect(result).toHaveLength(1);
        expect(result).toEqual(expect.arrayContaining(['pi@test.com']));
    });

    it('should return pi email if receivesEmails is true', () => {
        const application = buildApplication({
            primaryContact: { email: 'contact@test.com', receivesEmails: true },
            pi: { email: 'pi@test.com', receivesEmails: true }
        });
        const result = getCCEmails('submitter@test.com', application);
        expect(result).toHaveLength(2);
        expect(result).toEqual(expect.arrayContaining(['contact@test.com', 'pi@test.com']));
    });

    it('should return additional contact emails if receivesEmails is true', () => {
        const application = buildApplication({
            pi: { email: 'pi@test.com', receivesEmails: false },
            additionalContacts: [
                { email: 'contact1@test.com', receivesEmails: true },
                { email: 'contact2@test.com', receivesEmails: false }
            ]
        });
        const result = getCCEmails('submitter@test.com', application);
        expect(result).toHaveLength(1);
        expect(result).toEqual(expect.arrayContaining(['contact1@test.com']));
    });

    it('should return PI emails if PI is set as primary contact and receivesEmails is true', () => {
        const application = buildApplication({
            piAsPrimaryContact: true,
            pi: { email: 'pi@test.com', receivesEmails: true }
        });
        const result = getCCEmails('submitter@test.com', application);
        expect(result).toHaveLength(1);
        expect(result).toEqual(expect.arrayContaining(['pi@test.com']));
    });

    it('should accept questionnaire data as an object', () => {
        const application = {
            questionnaireData: {
                pi: { email: 'pi@test.com', receivesEmails: false },
                primaryContact: { email: 'contact@test.com', receivesEmails: true },
                additionalContacts: [
                    { email: 'contact1@test.com', receivesEmails: true },
                    { email: 'contact2@test.com', receivesEmails: false }
                ]
            }
        };
        const result = getCCEmails('submitter@test.com', application);
        expect(result).toHaveLength(2);
        expect(result).toEqual(expect.arrayContaining(['contact1@test.com', 'contact@test.com']));
    });


});

function buildApplication(questionnaire) {
    return {
        questionnaireData: JSON.stringify(questionnaire)
    }
}