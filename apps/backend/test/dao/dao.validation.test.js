jest.mock('../../mongoose/models/validation', () => ({
    modelName: 'Validation',
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
}));

const ValidationDAO = require('../../dao/validation');
const ValidationModel = require('../../mongoose/models/validation');
const MongooseGenericDAO = require('../../dao/mongoose-generic');

describe('ValidationDAO', () => {
    let dao;

    beforeEach(() => {
        jest.clearAllMocks();
        dao = new ValidationDAO();
    });

    it('extends MongooseGenericDAO with the Validation model', () => {
        expect(dao).toBeInstanceOf(MongooseGenericDAO);
        expect(dao.model).toBe(ValidationModel);
        expect(dao._modelName).toBe('Validation');
    });

    it('creates a validation document via the model', async () => {
        const input = {
            submissionID: 'sub-1',
            type: ['metadata'],
            scope: 'New',
            started: new Date('2024-01-01T00:00:00Z'),
            status: 'Validating',
        };
        ValidationModel.create.mockResolvedValue({
            ...input,
            _id: 'val-1',
            toObject() {
                return { ...input, _id: 'val-1' };
            },
        });

        const result = await dao.create(input);

        expect(ValidationModel.create).toHaveBeenCalledWith(input);
        expect(result).toEqual(expect.objectContaining({
            id: 'val-1',
            _id: 'val-1',
            submissionID: 'sub-1',
            status: 'Validating',
        }));
    });
});
