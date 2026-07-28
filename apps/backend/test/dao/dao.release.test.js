jest.mock('../../mongoose/models/release', () => ({
    modelName: 'Release',
    findById: jest.fn(),
    distinct: jest.fn(),
    aggregate: jest.fn(),
}));

const ReleaseDAO = require('../../dao/release');
const ReleaseModel = require('../../mongoose/models/release');
const MongooseGenericDAO = require('../../dao/mongoose-generic');

describe('ReleaseDAO', () => {
    let releaseDAO;

    beforeEach(() => {
        releaseDAO = new ReleaseDAO();
        jest.clearAllMocks();
    });

    it('should extend MongooseGenericDAO and use the Release model', () => {
        expect(releaseDAO).toBeInstanceOf(MongooseGenericDAO);
        expect(releaseDAO.model).toBe(ReleaseModel);
        expect(releaseDAO.model.modelName).toBe('Release');
    });

    it('should delegate distinct to the Release model', async () => {
        ReleaseModel.distinct.mockResolvedValue(['study', 'sample']);
        const result = await releaseDAO.distinct('nodeType', { studyID: 's1' });
        expect(ReleaseModel.distinct).toHaveBeenCalledWith('nodeType', { studyID: 's1' });
        expect(result).toEqual(['study', 'sample']);
    });
});
