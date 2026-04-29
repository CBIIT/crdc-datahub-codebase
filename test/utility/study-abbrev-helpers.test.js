const {
    defaultStudyAbbreviationToStudyName,
    defaultStudyAbbreviationToNA,
    applyStudyAbbreviationFallbackToListPrograms
} = require('../../utility/study-abbrev-helpers');

describe('study-abbrev-helpers', () => {
    describe('defaultStudyAbbreviationToStudyName', () => {
        it('returns trimmed abbrev when present', () => {
            expect(defaultStudyAbbreviationToStudyName('  AB  ', 'Full Name')).toBe('AB');
        });
        it('returns fullName when abbrev null or empty or whitespace', () => {
            expect(defaultStudyAbbreviationToStudyName(null, 'Full Study')).toBe('Full Study');
            expect(defaultStudyAbbreviationToStudyName('', 'Full Study')).toBe('Full Study');
            expect(defaultStudyAbbreviationToStudyName('  \t ', 'Full Study')).toBe('Full Study');
        });
        it('returns empty string when both missing', () => {
            expect(defaultStudyAbbreviationToStudyName(null, null)).toBe('');
            expect(defaultStudyAbbreviationToStudyName(' ', '  ')).toBe('');
        });
    });

    describe('defaultStudyAbbreviationToNA', () => {
        it('returns trimmed abbrev when present', () => {
            expect(defaultStudyAbbreviationToNA('  x  ')).toBe('x');
        });
        it('returns NA when null empty or whitespace', () => {
            expect(defaultStudyAbbreviationToNA(null)).toBe('NA');
            expect(defaultStudyAbbreviationToNA('')).toBe('NA');
            expect(defaultStudyAbbreviationToNA('   ')).toBe('NA');
        });
    });

    describe('applyStudyAbbreviationFallbackToListPrograms', () => {
        it('sets studyAbbreviation to studyName per study when abbrev is empty', () => {
            const input = {
                total: 1,
                programs: [
                    {
                        _id: 'org1',
                        name: 'Program 1',
                        studies: [{ studyName: 'Approved Name', studyAbbreviation: '   ' }]
                    }
                ]
            };
            const out = applyStudyAbbreviationFallbackToListPrograms(input);
            expect(out.programs[0].studies[0].studyAbbreviation).toBe('Approved Name');
        });
        it('returns the same object reference when there are no programs', () => {
            const empty = { total: 0, programs: [] };
            expect(applyStudyAbbreviationFallbackToListPrograms(empty)).toBe(empty);
        });
        it('returns the same object reference when programs have no studies arrays', () => {
            const input = {
                total: 1,
                programs: [{ _id: 'org1', name: 'Program 1' }]
            };
            expect(applyStudyAbbreviationFallbackToListPrograms(input)).toBe(input);
        });
    });
});
