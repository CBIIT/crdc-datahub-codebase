jest.mock('../../mongoose/models/approved-study', () => ({
    modelName: 'ApprovedStudy',
    find: jest.fn(),
}));

const ApprovedStudyModel = require('../../mongoose/models/approved-study');
const ApprovedStudyDAO = require('../../dao/approvedStudy');

/**
 * @param {*} resolvedValue
 * @returns {{ lean: jest.Mock, sort: jest.Mock, skip: jest.Mock, limit: jest.Mock }}
 */
function createLeanQuery(resolvedValue) {
    return {
        lean: jest.fn().mockResolvedValue(resolvedValue),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
    };
}

describe('ApprovedStudyDAO.findByStudyNames', () => {
    let dao;

    beforeEach(() => {
        jest.clearAllMocks();
        dao = new ApprovedStudyDAO();
    });

    it('returns an empty array for empty input', async () => {
        await expect(dao.findByStudyNames([])).resolves.toEqual([]);
        expect(ApprovedStudyModel.find).not.toHaveBeenCalled();
    });

    it('dedupes trimmed study names before querying', async () => {
        ApprovedStudyModel.find.mockReturnValue(
            createLeanQuery([{ _id: 'study-1', studyName: 'Alpha Study' }])
        );

        const result = await dao.findByStudyNames([' Alpha Study ', 'alpha study', '']);

        expect(ApprovedStudyModel.find).toHaveBeenCalledWith({
            $or: [
                { studyName: { $regex: '^Alpha Study$', $options: 'i' } },
            ],
        });
        expect(result).toEqual([
            { id: 'study-1', _id: 'study-1', studyName: 'Alpha Study' },
        ]);
    });

    it('queries multiple distinct study names in one request', async () => {
        ApprovedStudyModel.find.mockReturnValue(
            createLeanQuery([
                { _id: 'study-1', studyName: 'Alpha Study' },
                { _id: 'study-2', studyName: 'Beta Study' },
            ])
        );

        const result = await dao.findByStudyNames(['Alpha Study', 'Beta Study']);

        expect(ApprovedStudyModel.find).toHaveBeenCalledWith({
            $or: [
                { studyName: { $regex: '^Alpha Study$', $options: 'i' } },
                { studyName: { $regex: '^Beta Study$', $options: 'i' } },
            ],
        });
        expect(result).toHaveLength(2);
        expect(result[0]._id).toBe('study-1');
        expect(result[1]._id).toBe('study-2');
    });
});
