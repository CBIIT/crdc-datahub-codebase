const { UserService } = require('../../services/user');
const { USER } = require('../../crdc-datahub-database-drivers/constants/user-constants');
const USER_PERMISSION_CONSTANTS = require('../../crdc-datahub-database-drivers/constants/user-permission-constants');

describe('UserService.getCollaboratorsByStudyID', () => {
    let userService;
    let mockUserDAO, mockLogCollection, mockOrganizationCollection,
        mockNotificationsService, mockApplicationCollection,
        mockOfficialEmail, mockAppUrl, mockApprovedStudiesService, mockInactiveUserDays,
        mockConfigurationService, mockInstitutionService, mockAuthorizationService;
    let studyID, submitterID;

    const mockCollaborators = [
        {
            _id: 'collaborator-1',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            role: USER.ROLES.SUBMITTER,
            userStatus: USER.STATUSES.ACTIVE,
            studies: [{ _id: 'study-123', name: 'Test Study' }],
            permissions: [`${USER_PERMISSION_CONSTANTS.DATA_SUBMISSION.CREATE}:own`]
        },
        {
            _id: 'collaborator-2',
            firstName: 'Bob',
            lastName: 'Johnson',
            email: 'bob@example.com',
            role: USER.ROLES.SUBMITTER,
            userStatus: USER.STATUSES.ACTIVE,
            studies: ['study-123', 'study-456'],
            permissions: [`${USER_PERMISSION_CONSTANTS.DATA_SUBMISSION.CREATE}:own`]
        },
        {
            _id: 'collaborator-3',
            firstName: 'Alice',
            lastName: 'Brown',
            email: 'alice@example.com',
            role: USER.ROLES.SUBMITTER,
            userStatus: USER.STATUSES.ACTIVE,
            studies: [{ _id: 'All', name: 'All Studies' }],
            permissions: [`${USER_PERMISSION_CONSTANTS.DATA_SUBMISSION.CREATE}:own`]
        }
    ];

    const mockApprovedStudies = [
        { _id: 'study-123', name: 'Test Study', status: 'Approved' },
        { _id: 'study-456', name: 'Another Study', status: 'Approved' },
        { _id: 'All', name: 'All Studies', status: 'Approved' }
    ];

    beforeEach(() => {
        jest.clearAllMocks();

        mockUserDAO = {
            getCollaboratorsByStudyID: jest.fn()
        };
        mockLogCollection = {};
        mockOrganizationCollection = {};
        mockNotificationsService = {};
        mockApplicationCollection = {};
        mockOfficialEmail = 'test@example.com';
        mockAppUrl = 'http://test.com';
        mockApprovedStudiesService = {};
        mockInactiveUserDays = 90;
        mockConfigurationService = {};
        mockInstitutionService = {};
        mockAuthorizationService = {};

        userService = new UserService(
            mockLogCollection,
            mockOrganizationCollection,
            mockNotificationsService,
            mockApplicationCollection,
            mockOfficialEmail,
            mockAppUrl,
            mockApprovedStudiesService,
            mockInactiveUserDays,
            mockConfigurationService,
            mockInstitutionService,
            mockAuthorizationService
        );
        userService.userDAO = mockUserDAO;

        studyID = 'study-123';
        submitterID = 'test-user-id';

        userService._findApprovedStudies = jest.fn().mockResolvedValue(mockApprovedStudies);
    });

    describe('Function signature', () => {
        it('should be a function', () => {
            expect(typeof userService.getCollaboratorsByStudyID).toBe('function');
        });

        it('should accept two parameters', () => {
            expect(userService.getCollaboratorsByStudyID.length).toBe(2); // studyID, submitterID
        });
    });

    describe('DAO delegation', () => {
        it('should call userDAO.getCollaboratorsByStudyID with studyID and submitterID', async () => {
            mockUserDAO.getCollaboratorsByStudyID.mockResolvedValue(mockCollaborators);

            await userService.getCollaboratorsByStudyID(studyID, submitterID);

            expect(mockUserDAO.getCollaboratorsByStudyID).toHaveBeenCalledWith(studyID, submitterID);
            expect(mockUserDAO.getCollaboratorsByStudyID).toHaveBeenCalledTimes(1);
        });
    });

    describe('Successful collaborator retrieval', () => {
        beforeEach(() => {
            mockUserDAO.getCollaboratorsByStudyID.mockResolvedValue(mockCollaborators);
        });

        it('should return collaborators with approved studies', async () => {
            const result = await userService.getCollaboratorsByStudyID(studyID, submitterID);

            expect(result).toEqual(mockCollaborators);
            expect(userService._findApprovedStudies).toHaveBeenCalledTimes(mockCollaborators.length);
        });

        it('should call _findApprovedStudies for each collaborator', async () => {
            await userService.getCollaboratorsByStudyID(studyID, submitterID);

            expect(userService._findApprovedStudies).toHaveBeenCalledWith(mockCollaborators[0].studies);
            expect(userService._findApprovedStudies).toHaveBeenCalledWith(mockCollaborators[1].studies);
            expect(userService._findApprovedStudies).toHaveBeenCalledWith(mockCollaborators[2].studies);
        });

        it('should handle empty collaborators list', async () => {
            mockUserDAO.getCollaboratorsByStudyID.mockResolvedValue([]);

            const result = await userService.getCollaboratorsByStudyID(studyID, submitterID);

            expect(result).toEqual([]);
            expect(userService._findApprovedStudies).not.toHaveBeenCalled();
        });

        it('should handle single collaborator', async () => {
            const singleCollaborator = [mockCollaborators[0]];
            mockUserDAO.getCollaboratorsByStudyID.mockResolvedValue(singleCollaborator);

            const result = await userService.getCollaboratorsByStudyID(studyID, submitterID);

            expect(result).toEqual(singleCollaborator);
            expect(userService._findApprovedStudies).toHaveBeenCalledTimes(1);
        });
    });

    describe('Study access patterns', () => {
        beforeEach(() => {
            mockUserDAO.getCollaboratorsByStudyID.mockResolvedValue(mockCollaborators);
        });

        it('should handle users with object-based studies', async () => {
            const userWithObjectStudies = {
                ...mockCollaborators[0],
                studies: [{ _id: 'study-123', name: 'Test Study' }]
            };
            mockUserDAO.getCollaboratorsByStudyID.mockResolvedValue([userWithObjectStudies]);

            const result = await userService.getCollaboratorsByStudyID(studyID, submitterID);

            expect(result).toEqual([userWithObjectStudies]);
            expect(userService._findApprovedStudies).toHaveBeenCalledWith([{ _id: 'study-123', name: 'Test Study' }]);
        });

        it('should handle users with string-based studies', async () => {
            const userWithStringStudies = {
                ...mockCollaborators[1],
                studies: ['study-123', 'study-456']
            };
            mockUserDAO.getCollaboratorsByStudyID.mockResolvedValue([userWithStringStudies]);

            const result = await userService.getCollaboratorsByStudyID(studyID, submitterID);

            expect(result).toEqual([userWithStringStudies]);
            expect(userService._findApprovedStudies).toHaveBeenCalledWith(['study-123', 'study-456']);
        });

        it('should handle users with "All" study access', async () => {
            const userWithAllAccess = {
                ...mockCollaborators[2],
                studies: [{ _id: 'All', name: 'All Studies' }]
            };
            mockUserDAO.getCollaboratorsByStudyID.mockResolvedValue([userWithAllAccess]);

            const result = await userService.getCollaboratorsByStudyID(studyID, submitterID);

            expect(result).toEqual([userWithAllAccess]);
            expect(userService._findApprovedStudies).toHaveBeenCalledWith([{ _id: 'All', name: 'All Studies' }]);
        });

        it('should handle users with mixed study access formats', async () => {
            const userWithMixedStudies = {
                ...mockCollaborators[0],
                studies: ['study-123', { _id: 'All', name: 'All Studies' }]
            };
            mockUserDAO.getCollaboratorsByStudyID.mockResolvedValue([userWithMixedStudies]);

            const result = await userService.getCollaboratorsByStudyID(studyID, submitterID);

            expect(result).toEqual([userWithMixedStudies]);
            expect(userService._findApprovedStudies).toHaveBeenCalledWith(['study-123', { _id: 'All', name: 'All Studies' }]);
        });
    });

    describe('Error handling', () => {
        it('should handle DAO getCollaboratorsByStudyID error', async () => {
            mockUserDAO.getCollaboratorsByStudyID.mockRejectedValue(new Error('Database error'));

            await expect(userService.getCollaboratorsByStudyID(studyID, submitterID))
                .rejects.toThrow('Database error');
        });

        it('should handle _findApprovedStudies error', async () => {
            mockUserDAO.getCollaboratorsByStudyID.mockResolvedValue(mockCollaborators);
            userService._findApprovedStudies = jest.fn().mockRejectedValue(new Error('Approved studies error'));

            await expect(userService.getCollaboratorsByStudyID(studyID, submitterID))
                .rejects.toThrow('Approved studies error');
        });

        it('should handle partial _findApprovedStudies errors', async () => {
            mockUserDAO.getCollaboratorsByStudyID.mockResolvedValue(mockCollaborators);
            userService._findApprovedStudies = jest.fn()
                .mockResolvedValueOnce(mockApprovedStudies)
                .mockRejectedValueOnce(new Error('Second user error'))
                .mockResolvedValueOnce(mockApprovedStudies);

            await expect(userService.getCollaboratorsByStudyID(studyID, submitterID))
                .rejects.toThrow('Second user error');
        });
    });

    describe('Edge cases', () => {
        it('should handle collaborators with undefined studies', async () => {
            const userWithUndefinedStudies = {
                ...mockCollaborators[0],
                studies: undefined
            };
            mockUserDAO.getCollaboratorsByStudyID.mockResolvedValue([userWithUndefinedStudies]);

            const result = await userService.getCollaboratorsByStudyID(studyID, submitterID);

            expect(result).toEqual([userWithUndefinedStudies]);
            expect(userService._findApprovedStudies).toHaveBeenCalledWith(undefined);
        });

        it('should handle collaborators with null studies', async () => {
            const userWithNullStudies = {
                ...mockCollaborators[0],
                studies: null
            };
            mockUserDAO.getCollaboratorsByStudyID.mockResolvedValue([userWithNullStudies]);

            const result = await userService.getCollaboratorsByStudyID(studyID, submitterID);

            expect(result).toEqual([userWithNullStudies]);
            expect(userService._findApprovedStudies).toHaveBeenCalledWith(null);
        });

        it('should handle collaborators with empty studies array', async () => {
            const userWithEmptyStudies = {
                ...mockCollaborators[0],
                studies: []
            };
            mockUserDAO.getCollaboratorsByStudyID.mockResolvedValue([userWithEmptyStudies]);

            const result = await userService.getCollaboratorsByStudyID(studyID, submitterID);

            expect(result).toEqual([userWithEmptyStudies]);
            expect(userService._findApprovedStudies).toHaveBeenCalledWith([]);
        });
    });

    describe('Performance considerations', () => {
        it('should make only one DAO call regardless of number of collaborators', async () => {
            const manyCollaborators = Array.from({ length: 100 }, (_, i) => ({
                ...mockCollaborators[0],
                _id: `collaborator-${i}`
            }));
            mockUserDAO.getCollaboratorsByStudyID.mockResolvedValue(manyCollaborators);

            await userService.getCollaboratorsByStudyID(studyID, submitterID);

            expect(mockUserDAO.getCollaboratorsByStudyID).toHaveBeenCalledTimes(1);
            expect(userService._findApprovedStudies).toHaveBeenCalledTimes(100);
        });

        it('should process collaborators sequentially', async () => {
            const processingOrder = [];
            userService._findApprovedStudies = jest.fn().mockImplementation(async (studies) => {
                processingOrder.push(studies);
                return mockApprovedStudies;
            });
            mockUserDAO.getCollaboratorsByStudyID.mockResolvedValue(mockCollaborators);

            await userService.getCollaboratorsByStudyID(studyID, submitterID);

            expect(processingOrder).toHaveLength(mockCollaborators.length);
            expect(processingOrder[0]).toEqual(mockCollaborators[0].studies);
            expect(processingOrder[1]).toEqual(mockCollaborators[1].studies);
            expect(processingOrder[2]).toEqual(mockCollaborators[2].studies);
        });
    });
});
