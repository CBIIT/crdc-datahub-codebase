const { DEFAULT_GPA_NAME, PendingGPA } = require('../../domain/pending-gpa');

describe('PendingGPA', () => {
    describe('resolveGPAName', () => {
        it('returns trimmed GPA name when provided for controlled access', () => {
            expect(PendingGPA.resolveGPAName('  Test GPA  ', true)).toBe('Test GPA');
        });

        it.each([
            [undefined],
            [null],
            [''],
            ['   '],
        ])('defaults to Not Provided for controlled access when GPA is %p', (GPAName) => {
            expect(PendingGPA.resolveGPAName(GPAName, true)).toBe(DEFAULT_GPA_NAME);
        });

        it.each([
            [undefined, ''],
            [null, ''],
            ['', ''],
        ])('returns empty string for non-controlled access when GPA is %p', (GPAName, expected) => {
            expect(PendingGPA.resolveGPAName(GPAName, false)).toBe(expected);
        });

        it('preserves provided GPA name for non-controlled access', () => {
            expect(PendingGPA.resolveGPAName('Open Access GPA', false)).toBe('Open Access GPA');
        });
    });
});
