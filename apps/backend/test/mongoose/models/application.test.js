const ApplicationModel = require('../../../mongoose/models/application');

describe('Application mongoose schema', () => {
    it('allows empty draft form fields while requiring version, status, and questionnaireData', async () => {
        const draft = new ApplicationModel({
            version: '3.0',
            status: 'New',
            questionnaireData: '{}',
            programName: '',
            studyName: '',
            studyAbbreviation: '',
        });
        await expect(draft.validate()).resolves.toBeUndefined();
    });

    it('rejects documents missing genuinely required fields', async () => {
        const missingRequired = new ApplicationModel({
            programName: '',
            studyName: '',
            studyAbbreviation: '',
        });
        let error;
        try {
            await missingRequired.validate();
        } catch (err) {
            error = err;
        }
        expect(error).toBeDefined();
        expect(error.errors.version).toBeDefined();
        expect(error.errors.status).toBeDefined();
        expect(error.errors.questionnaireData).toBeDefined();
        expect(error.errors.programName).toBeUndefined();
        expect(error.errors.studyName).toBeUndefined();
        expect(error.errors.studyAbbreviation).toBeUndefined();
    });
});
