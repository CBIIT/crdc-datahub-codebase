jest.mock('../../prisma', () => ({
    approvedStudy: {
        findMany: jest.fn(),
    },
}));

const prisma = require('../../prisma');
const ApprovedStudyDAO = require('../../dao/approvedStudy');

describe('ApprovedStudyDAO.findByStudyNames', () => {
    let dao;

    beforeEach(() => {
        jest.clearAllMocks();
        dao = new ApprovedStudyDAO({});
    });

    it('returns an empty array for empty input', async () => {
        await expect(dao.findByStudyNames([])).resolves.toEqual([]);
        expect(prisma.approvedStudy.findMany).not.toHaveBeenCalled();
    });

    it('dedupes trimmed study names before querying', async () => {
        prisma.approvedStudy.findMany.mockResolvedValue([
            { id: 'study-1', studyName: 'Alpha Study' },
        ]);

        const result = await dao.findByStudyNames([' Alpha Study ', 'alpha study', '']);

        expect(prisma.approvedStudy.findMany).toHaveBeenCalledWith({
            where: {
                OR: [
                    { studyName: { equals: 'Alpha Study', mode: 'insensitive' } },
                ],
            },
        });
        expect(result).toEqual([{ id: 'study-1', studyName: 'Alpha Study', _id: 'study-1' }]);
    });

    it('queries multiple distinct study names in one request', async () => {
        prisma.approvedStudy.findMany.mockResolvedValue([
            { id: 'study-1', studyName: 'Alpha Study' },
            { id: 'study-2', studyName: 'Beta Study' },
        ]);

        const result = await dao.findByStudyNames(['Alpha Study', 'Beta Study']);

        expect(prisma.approvedStudy.findMany).toHaveBeenCalledWith({
            where: {
                OR: [
                    { studyName: { equals: 'Alpha Study', mode: 'insensitive' } },
                    { studyName: { equals: 'Beta Study', mode: 'insensitive' } },
                ],
            },
        });
        expect(result).toHaveLength(2);
        expect(result[0]._id).toBe('study-1');
        expect(result[1]._id).toBe('study-2');
    });
});
