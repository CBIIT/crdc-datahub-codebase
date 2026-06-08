const {
    convertMongoFilterToPrismaFilter,
    nullOrMissingMongoCondition,
} = require('../../../dao/utils/orm-converter');

describe('orm-converter nullOrMissingMongoCondition', () => {
    it('builds a mongo filter matching null or missing field values', () => {
        expect(nullOrMissingMongoCondition('nextRevisionId')).toEqual({
            $or: [
                { nextRevisionId: null },
                { nextRevisionId: { $exists: false } },
            ],
        });
    });

    it('converts null-or-missing mongo filter to prisma OR with isSet false', () => {
        const prismaFilter = convertMongoFilterToPrismaFilter({
            _id: 'approved-source-id',
            status: 'Approved',
            ...nullOrMissingMongoCondition('nextRevisionId'),
        });

        expect(prismaFilter).toEqual({
            id: 'approved-source-id',
            status: 'Approved',
            OR: [
                { nextRevisionId: null },
                { nextRevisionId: { isSet: false } },
            ],
        });
    });
});
