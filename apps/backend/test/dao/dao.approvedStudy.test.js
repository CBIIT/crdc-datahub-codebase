jest.mock('../../mongoose/models/approved-study', () => ({
    modelName: 'ApprovedStudy',
    findById: jest.fn(),
}));

const ApprovedStudyDAO = require('../../dao/approvedStudy');
const ApprovedStudyModel = require('../../mongoose/models/approved-study');

/**
 * @param {*} resolvedValue
 * @returns {{ lean: jest.Mock }}
 */
function createLeanQuery(resolvedValue) {
    return {
        lean: jest.fn().mockResolvedValue(resolvedValue),
    };
}

describe('ApprovedStudyDAO', () => {
    let approvedStudyDAO;

    beforeEach(() => {
        approvedStudyDAO = new ApprovedStudyDAO();
        jest.clearAllMocks();
    });

    describe('getApprovedStudyByID', () => {
        it('should call findById with the correct studyID and return the mapped result', async () => {
            const studyID = '123';
            ApprovedStudyModel.findById.mockReturnValue(
                createLeanQuery({ _id: studyID, studyName: 'Test Study' })
            );

            const result = await approvedStudyDAO.getApprovedStudyByID(studyID);

            expect(ApprovedStudyModel.findById).toHaveBeenCalledWith(studyID);
            expect(result).toEqual({
                id: studyID,
                _id: studyID,
                studyName: 'Test Study',
            });
        });

        it('should return null if findById returns null', async () => {
            ApprovedStudyModel.findById.mockReturnValue(createLeanQuery(null));

            const result = await approvedStudyDAO.getApprovedStudyByID('notfound');

            expect(ApprovedStudyModel.findById).toHaveBeenCalledWith('notfound');
            expect(result).toBeNull();
        });

        it('should propagate errors from findById', async () => {
            ApprovedStudyModel.findById.mockReturnValue({
                lean: jest.fn().mockRejectedValue(new Error('Database error')),
            });

            await expect(approvedStudyDAO.getApprovedStudyByID('error')).rejects.toThrow(
                'Failed to find ApprovedStudy by ID'
            );
            expect(ApprovedStudyModel.findById).toHaveBeenCalledWith('error');
        });
    });
});
