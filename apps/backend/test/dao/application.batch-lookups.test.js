jest.mock('../../prisma', () => ({
    application: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
    },
}));

const prisma = require('../../prisma');
const ApplicationDAO = require('../../dao/application');

describe('ApplicationDAO batch application lookups', () => {
    let dao;

    beforeEach(() => {
        jest.clearAllMocks();
        dao = new ApplicationDAO({});
    });

    describe('findApplicationStatusesByIds', () => {
        it('returns an empty array when ids is empty', async () => {
            const result = await dao.findApplicationStatusesByIds([]);

            expect(result).toEqual([]);
            expect(prisma.application.findMany).not.toHaveBeenCalled();
        });

        it('loads application statuses in one query', async () => {
            prisma.application.findMany.mockResolvedValue([
                { id: 'successor-active', status: 'Reopened' },
            ]);

            const result = await dao.findApplicationStatusesByIds(['successor-active', 'successor-canceled']);

            expect(prisma.application.findMany).toHaveBeenCalledWith({
                where: { id: { in: ['successor-active', 'successor-canceled'] } },
                select: { id: true, status: true },
            });
            expect(result).toEqual([{ id: 'successor-active', status: 'Reopened', _id: 'successor-active' }]);
        });
    });

    describe('findApprovedApplicationsByNextRevisionIds', () => {
        it('returns an empty array when nextRevisionIds is empty', async () => {
            const result = await dao.findApprovedApplicationsByNextRevisionIds([]);

            expect(result).toEqual([]);
            expect(prisma.application.findMany).not.toHaveBeenCalled();
        });

        it('loads approved applications by nextRevisionId in one query', async () => {
            prisma.application.findMany.mockResolvedValue([
                { nextRevisionId: 'c2' },
            ]);

            const result = await dao.findApprovedApplicationsByNextRevisionIds(['c2', 'd2']);

            expect(prisma.application.findMany).toHaveBeenCalledWith({
                where: { nextRevisionId: { in: ['c2', 'd2'] }, status: 'Approved' },
                select: { nextRevisionId: true },
            });
            expect(result).toEqual([{ nextRevisionId: 'c2' }]);
        });
    });

    describe('findApprovedParentSubmissionRequestByID', () => {
        it('returns null when id is falsy', async () => {
            await expect(dao.findApprovedParentSubmissionRequestByID(null)).resolves.toBeNull();
            expect(prisma.application.findFirst).not.toHaveBeenCalled();
        });

        it('loads the Approved parent linking to the successor via nextRevisionId', async () => {
            prisma.application.findFirst.mockResolvedValue({
                id: 'parent-app',
                status: 'Approved',
                nextRevisionId: 'successor-app',
            });

            const result = await dao.findApprovedParentSubmissionRequestByID('successor-app');

            expect(prisma.application.findFirst).toHaveBeenCalledWith({
                where: { nextRevisionId: 'successor-app', status: 'Approved' },
            });
            expect(result).toEqual({
                id: 'parent-app',
                status: 'Approved',
                nextRevisionId: 'successor-app',
                _id: 'parent-app',
            });
        });

        it('returns null when no Approved parent links to the successor', async () => {
            prisma.application.findFirst.mockResolvedValue(null);

            await expect(dao.findApprovedParentSubmissionRequestByID('orphan-app')).resolves.toBeNull();
        });
    });

    describe('findApplicationStatusById', () => {
        it('returns null when id is falsy', async () => {
            await expect(dao.findApplicationStatusById(null)).resolves.toBeNull();
            expect(prisma.application.findFirst).not.toHaveBeenCalled();
        });

        it('loads status with prisma findFirst', async () => {
            prisma.application.findFirst.mockResolvedValue({ status: 'Reopened' });

            const result = await dao.findApplicationStatusById('successor-id');

            expect(prisma.application.findFirst).toHaveBeenCalledWith({
                where: { id: 'successor-id' },
                select: { status: true },
            });
            expect(result).toEqual({ status: 'Reopened' });
        });
    });

    describe('findApplicationWithApplicantById', () => {
        it('returns null when id is falsy', async () => {
            await expect(dao.findApplicationWithApplicantById(null)).resolves.toBeNull();
            expect(prisma.application.findFirst).not.toHaveBeenCalled();
        });

        it('loads application with applicant include', async () => {
            prisma.application.findFirst.mockResolvedValue({
                id: 'app1',
                status: 'Approved',
                applicant: { id: 'u1', fullName: 'Alice', email: 'a@a' },
            });

            const result = await dao.findApplicationWithApplicantById('app1');

            expect(prisma.application.findFirst).toHaveBeenCalledWith({
                where: { id: 'app1' },
                include: {
                    applicant: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            fullName: true,
                            email: true,
                        },
                    },
                },
            });
            expect(result._id).toBe('app1');
        });
    });

    describe('findLatestApprovedByApplicantID', () => {
        it('returns null when applicantID is falsy', async () => {
            await expect(dao.findLatestApprovedByApplicantID(null)).resolves.toBeNull();
            expect(prisma.application.findFirst).not.toHaveBeenCalled();
        });

        it('loads the latest approved application for an applicant', async () => {
            prisma.application.findFirst.mockResolvedValue({ id: 'app-latest', status: 'Approved' });

            const result = await dao.findLatestApprovedByApplicantID('user1');

            expect(prisma.application.findFirst).toHaveBeenCalledWith({
                where: { applicantID: 'user1', status: 'Approved' },
                orderBy: { createdAt: 'desc' },
            });
            expect(result).toEqual({ id: 'app-latest', status: 'Approved', _id: 'app-latest' });
        });
    });
});
