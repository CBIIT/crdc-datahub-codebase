describe('email content URL helpers', () => {
    const ORIGINAL_ENV = { ...process.env };

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...ORIGINAL_ENV };
        delete process.env.EMAIL_CONTENT_REFRESH_SECONDS;
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    it('maps dev to the dev raw GitHub branch', () => {
        const config = require('../config');
        expect(config.getEmailContentBranch('dev')).toBe('dev');
        expect(config.getEmailContentBaseUrl('dev')).toBe(
            'https://raw.githubusercontent.com/CBIIT/crdc-submission-portal-email-content/dev'
        );
    });

    it('lowercases QA to qa', () => {
        const config = require('../config');
        expect(config.getEmailContentBranch('QA')).toBe('qa');
        expect(config.getEmailContentBaseUrl('QA')).toBe(
            'https://raw.githubusercontent.com/CBIIT/crdc-submission-portal-email-content/qa'
        );
    });

    it('keeps prod as prod (does not strip production)', () => {
        const config = require('../config');
        expect(config.getEmailContentBranch('prod')).toBe('prod');
        expect(config.getEmailContentBaseUrl('prod')).toBe(
            'https://raw.githubusercontent.com/CBIIT/crdc-submission-portal-email-content/prod'
        );
    });

    it('defaults missing TIER to prod', () => {
        const config = require('../config');
        expect(config.getEmailContentBranch(undefined)).toBe('prod');
        expect(config.getEmailContentBaseUrl(undefined)).toBe(
            'https://raw.githubusercontent.com/CBIIT/crdc-submission-portal-email-content/prod'
        );
    });

    it('defaults refresh seconds to 300', () => {
        const config = require('../config');
        expect(config.getEmailContentRefreshSeconds()).toBe(300);
    });
});
