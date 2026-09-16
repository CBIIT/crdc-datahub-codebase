jest.mock('../../mongoose/models/batch', () => ({
    modelName: 'Batch',
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    deleteMany: jest.fn(),
    countDocuments: jest.fn(),
}));

const BatchDAO = require('../../dao/batch');
const BatchModel = require('../../mongoose/models/batch');

/**
 * Builds a thenable lean query mock that resolves or rejects with the given value/error.
 * @param {*} resolvedValue
 * @param {Error} [rejectedError]
 * @returns {{ lean: jest.Mock, select: jest.Mock, sort: jest.Mock, skip: jest.Mock, limit: jest.Mock }}
 */
function createLeanQuery(resolvedValue, rejectedError) {
    const lean = rejectedError
        ? jest.fn().mockRejectedValue(rejectedError)
        : jest.fn().mockResolvedValue(resolvedValue);
    return {
        lean,
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
    };
}

describe('BatchDAO Error Handling', () => {
    let batchDAO;
    let consoleSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        batchDAO = new BatchDAO();
        consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    describe('deleteBatchesBySubmissionID method', () => {
        it('should handle constraint violation errors', async () => {
            const submissionID = 'sub-123';
            const constraintError = new Error('Foreign key constraint violation');

            BatchModel.deleteMany.mockRejectedValue(constraintError);

            await expect(batchDAO.deleteBatchesBySubmissionID(submissionID)).rejects.toThrow('Failed to delete batches');
        });

        it('should handle invalid submissionID errors', async () => {
            const invalidSubmissionID = undefined;

            await expect(batchDAO.deleteBatchesBySubmissionID(invalidSubmissionID)).resolves.toBeUndefined();
            expect(BatchModel.deleteMany).not.toHaveBeenCalled();
        });
    });

    describe('findByStatus method', () => {
        it('should handle findOne errors gracefully', async () => {
            const submissionID = 'sub-123';
            const status = 'Uploaded';
            const queryError = new Error('Query execution failed');

            BatchModel.findOne.mockReturnValue(createLeanQuery(null, queryError));

            await expect(batchDAO.findByStatus(submissionID, status)).rejects.toThrow('Failed to find batch by status');

            expect(consoleSpy).toHaveBeenCalledWith('BatchDAO.findByStatus failed:', {
                error: 'Query execution failed',
                submissionID,
                status,
                stack: queryError.stack
            });
        });

        it('should handle database connection errors', async () => {
            const submissionID = 'sub-123';
            const status = 'Uploaded';
            const connectionError = new Error('Connection timeout');

            BatchModel.findOne.mockReturnValue(createLeanQuery(null, connectionError));

            await expect(batchDAO.findByStatus(submissionID, status)).rejects.toThrow('Failed to find batch by status');
        });

        it('should return mapped batch when found', async () => {
            const submissionID = 'sub-123';
            const status = 'Uploaded';

            BatchModel.findOne.mockReturnValue(
                createLeanQuery({ _id: 'batch-1', submissionID, status })
            );

            const result = await batchDAO.findByStatus(submissionID, status);

            expect(BatchModel.findOne).toHaveBeenCalledWith({ submissionID, status });
            expect(result).toEqual([{
                id: 'batch-1',
                _id: 'batch-1',
                submissionID,
                status,
            }]);
        });

        it('should return empty array when no batch found', async () => {
            BatchModel.findOne.mockReturnValue(createLeanQuery(null));

            const result = await batchDAO.findByStatus('sub-123', 'Uploaded');

            expect(result).toEqual([]);
        });
    });

    describe('getNextDisplayID method', () => {
        it('should handle countDocuments errors gracefully', async () => {
            const submissionID = 'sub-123';
            const countError = new Error('Count operation failed');

            BatchModel.countDocuments.mockRejectedValue(countError);

            await expect(batchDAO.getNextDisplayID(submissionID)).rejects.toThrow('Failed to get next display ID');

            expect(consoleSpy).toHaveBeenCalledWith('BatchDAO.getNextDisplayID failed:', {
                error: 'Count operation failed',
                submissionID,
                stack: countError.stack
            });
        });

        it('should handle database connection errors', async () => {
            const submissionID = 'sub-123';
            const connectionError = new Error('Database connection lost');

            BatchModel.countDocuments.mockRejectedValue(connectionError);

            await expect(batchDAO.getNextDisplayID(submissionID)).rejects.toThrow('Failed to get next display ID');
        });

        it('should return count plus one', async () => {
            BatchModel.countDocuments.mockResolvedValue(2);

            const result = await batchDAO.getNextDisplayID('sub-123');

            expect(BatchModel.countDocuments).toHaveBeenCalledWith({ submissionID: 'sub-123' });
            expect(result).toBe(3);
        });
    });

    describe('getLastFileBatchID method', () => {
        it('should handle findOne errors gracefully', async () => {
            const submissionID = 'sub-123';
            const fileName = 'test.csv';
            const queryError = new Error('Query execution failed');

            BatchModel.findOne.mockReturnValue(createLeanQuery(null, queryError));

            await expect(batchDAO.getLastFileBatchID(submissionID, fileName)).rejects.toThrow('Failed to get last file batch ID');

            expect(consoleSpy).toHaveBeenCalledWith('BatchDAO.getLastFileBatchID failed:', {
                error: 'Query execution failed',
                submissionID,
                fileName,
                maxBatches: 10,
                stack: queryError.stack
            });
        });

        it('should handle database connection errors', async () => {
            const submissionID = 'sub-123';
            const fileName = 'test.csv';
            const connectionError = new Error('Connection timeout');

            BatchModel.findOne.mockReturnValue(createLeanQuery(null, connectionError));

            await expect(batchDAO.getLastFileBatchID(submissionID, fileName)).rejects.toThrow('Failed to get last file batch ID');
        });

        it('should query with $elemMatch, select displayID, and sort by displayID descending', async () => {
            const submissionID = 'sub-123';
            const fileName = 'test.csv';
            const query = createLeanQuery({ _id: 'batch-1', displayID: 5 });

            BatchModel.findOne.mockReturnValue(query);

            const result = await batchDAO.getLastFileBatchID(submissionID, fileName);

            expect(BatchModel.findOne).toHaveBeenCalledWith({
                submissionID,
                type: 'data file',
                status: 'Uploaded',
                files: {
                    $elemMatch: {
                        fileName,
                        status: 'Uploaded',
                    },
                },
            });
            expect(query.select).toHaveBeenCalledWith('displayID');
            expect(query.sort).toHaveBeenCalledWith({ displayID: -1 });
            expect(result).toBe(5);
        });

        it('should return null when no matching batch is found', async () => {
            BatchModel.findOne.mockReturnValue(createLeanQuery(null));

            const result = await batchDAO.getLastFileBatchID('sub-123', 'missing.csv');

            expect(result).toBeNull();
        });

        it('should handle custom maxBatches parameter', async () => {
            const submissionID = 'sub-123';
            const fileName = 'test.csv';
            const maxBatches = 5;
            const limitError = new Error('Query limit exceeded');

            BatchModel.findOne.mockReturnValue(createLeanQuery(null, limitError));

            await expect(batchDAO.getLastFileBatchID(submissionID, fileName, maxBatches)).rejects.toThrow('Failed to get last file batch ID');
            expect(consoleSpy).toHaveBeenCalledWith('BatchDAO.getLastFileBatchID failed:', expect.objectContaining({
                maxBatches: 5,
            }));
        });
    });

    describe('Inherited method error handling', () => {
        it('should handle create errors from MongooseGenericDAO', async () => {
            const batchData = { name: 'Test Batch', submissionID: 'sub-123' };
            const createError = new Error('Create operation failed');

            BatchModel.create.mockRejectedValue(createError);

            await expect(batchDAO.create(batchData)).rejects.toThrow('Failed to create Batch');
        });

        it('should handle update errors from MongooseGenericDAO', async () => {
            const batchId = 'batch-123';
            const updateData = { name: 'Updated Batch' };
            const updateError = new Error('Update operation failed');

            BatchModel.findByIdAndUpdate.mockReturnValue(createLeanQuery(null, updateError));

            await expect(batchDAO.update(batchId, updateData)).rejects.toThrow('Failed to update Batch');
        });

        it('should handle findById errors from MongooseGenericDAO', async () => {
            const batchId = 'batch-123';
            const findError = new Error('Find operation failed');

            BatchModel.findById.mockReturnValue(createLeanQuery(null, findError));

            await expect(batchDAO.findById(batchId)).rejects.toThrow('Failed to find Batch by ID');
        });

        it('should handle findMany errors from MongooseGenericDAO', async () => {
            const filter = { status: 'active' };
            const findError = new Error('FindMany operation failed');

            BatchModel.find.mockReturnValue(createLeanQuery(null, findError));

            await expect(batchDAO.findMany(filter, { sort: { createdAt: 'desc' } })).rejects.toThrow('Failed to find many Batch');
        });

        it('should handle count errors from MongooseGenericDAO', async () => {
            const where = { status: 'active' };
            const countError = new Error('Count operation failed');

            BatchModel.countDocuments.mockRejectedValue(countError);

            await expect(batchDAO.count(where)).rejects.toThrow('Failed to count Batch');
        });
    });

    describe('Error message consistency', () => {
        it('should include "Batch" model name in all error messages', async () => {
            const testData = { submissionID: 'sub-123' };
            const createError = new Error('Generic error');

            BatchModel.create.mockRejectedValue(createError);

            try {
                await batchDAO.create(testData);
            } catch (error) {
                expect(error.message).toContain('Batch');
            }
        });

        it('should preserve original error messages in console logs', async () => {
            const submissionID = 'sub-123';
            const originalError = new Error('Original error message');

            BatchModel.countDocuments.mockRejectedValue(originalError);

            try {
                await batchDAO.getNextDisplayID(submissionID);
            } catch (error) {
                expect(error.message).not.toContain('Original error message');
            }

            expect(consoleSpy).toHaveBeenCalledWith('BatchDAO.getNextDisplayID failed:', {
                error: 'Original error message',
                submissionID,
                stack: originalError.stack
            });
        });
    });

    describe('Console error logging consistency', () => {
        it('should log all error details including contextual information', async () => {
            const submissionID = 'sub-123';
            const status = 'Uploaded';
            const queryError = new Error('Test error');
            queryError.stack = 'Error stack trace';

            BatchModel.findOne.mockReturnValue(createLeanQuery(null, queryError));

            try {
                await batchDAO.findByStatus(submissionID, status);
            } catch (error) {
                // Error should be logged
            }

            expect(consoleSpy).toHaveBeenCalledWith(
                'BatchDAO.findByStatus failed:',
                expect.objectContaining({
                    error: 'Test error',
                    submissionID: 'sub-123',
                    status: 'Uploaded',
                    stack: 'Error stack trace'
                })
            );
        });

        it('should log different error contexts for different methods', async () => {
            const submissionID = 'sub-123';
            const fileName = 'test.tsv';
            const queryError = new Error('Query failed');

            BatchModel.findOne.mockReturnValue(createLeanQuery(null, queryError));

            try {
                await batchDAO.getLastFileBatchID(submissionID, fileName);
            } catch (error) {
                // Error should be logged
            }

            expect(consoleSpy).toHaveBeenCalledWith(
                'BatchDAO.getLastFileBatchID failed:',
                expect.objectContaining({
                    error: 'Query failed',
                    submissionID: 'sub-123',
                    fileName: 'test.tsv',
                    maxBatches: 10
                })
            );
        });
    });

    describe('Edge cases and error scenarios', () => {
        it('should handle null/undefined parameters gracefully', async () => {
            const queryError = new Error('Parameter validation failed');

            BatchModel.findOne.mockReturnValue(createLeanQuery(null, queryError));

            try {
                await batchDAO.findByStatus(null, undefined);
            } catch (error) {
                expect(error.message).toContain('Failed to find batch by status');
                expect(error.message).not.toContain('Parameter validation failed');
            }
        });

        it('should handle empty string parameters', async () => {
            const countError = new Error('Empty parameter error');

            BatchModel.countDocuments.mockRejectedValue(countError);

            try {
                await batchDAO.getNextDisplayID('');
            } catch (error) {
                expect(error.message).toContain('Failed to get next display ID');
                expect(error.message).not.toContain('Empty parameter error');
            }
        });

        it('should handle very long parameter values', async () => {
            const longSubmissionID = 'a'.repeat(1000);
            const queryError = new Error('Parameter too long');

            BatchModel.findOne.mockReturnValue(createLeanQuery(null, queryError));

            try {
                await batchDAO.findByStatus(longSubmissionID, 'status');
            } catch (error) {
                expect(error.message).toContain('Failed to find batch by status');
                expect(error.message).not.toContain('Parameter too long');
            }
        });
    });
});
