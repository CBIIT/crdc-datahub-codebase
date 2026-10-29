const { Submission } = require('../../services/submission');
const { DataSyncService } = require('../../services/dataSync.service');
const ERROR = require('../../constants/error-constants');
const { DATA_SYNC_TYPE } = require('../../constants/data-sync-constants');
const { replaceErrorString } = require('../../utility/string-util');

jest.mock('sanitize-html', () => jest.fn((value) => value));

jest.mock('../../verifier/user-info-verifier', () => ({
    verifySession: jest.fn(() => ({ verifyInitialized: jest.fn() })),
}));

const USER_ID = 'user-1';
const SUBMISSION = { _id: 'sub-1', submitterID: USER_ID, studyID: 'study-1', dataCommons: 'CDS' };

function createScope(scopeName) {
    return {
        isNoneScope: () => scopeName === 'none',
        isAllScope: () => scopeName === 'all',
        isOwnScope: () => scopeName === 'own',
        isStudyScope: () => scopeName === 'study',
        isDCScope: () => scopeName === 'dc',
    };
}

describe('Submission DataSync resolvers', () => {
    let submissionService;
    let dataSyncService;
    let context;

    beforeEach(() => {
        dataSyncService = new DataSyncService();
        submissionService = new Submission(
            {}, {}, {}, {}, {}, {}, {}, jest.fn(), {}, 'queue', {}, {}, [], [], 'loader-queue',
            {}, {}, 'bucket', {}, {}, new Map(), {}, {},
            dataSyncService
        );
        submissionService._findByID = jest.fn(async (submissionID) => submissionID === SUBMISSION._id ? SUBMISSION : null);
        submissionService._getUserScope = jest.fn().mockResolvedValue(createScope('all'));
        context = { userInfo: { _id: USER_ID, studies: [], dataCommons: [] } };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('DocumentDB errors', () => {
        const FAILED_TO_LIST_DATA_SYNC = 'Failed to find many DataSync';
        const FAILED_TO_FIND_LATEST_DATA_SYNC = 'Failed to find first DataSync';

        it('listDataSyncs rejects with the DAO error', async () => {
            jest.spyOn(dataSyncService.dataSyncDAO, 'findMany').mockRejectedValue(new Error(FAILED_TO_LIST_DATA_SYNC));

            await expect(submissionService.listDataSyncs({ submissionID: 'sub-1' }, context))
                .rejects.toThrow(FAILED_TO_LIST_DATA_SYNC);
        });

        it('getLatestDataSync rejects with the DAO error', async () => {
            jest.spyOn(dataSyncService.dataSyncDAO, 'findFirst').mockRejectedValue(new Error(FAILED_TO_FIND_LATEST_DATA_SYNC));

            await expect(submissionService.getLatestDataSync({ submissionID: 'sub-1', type: DATA_SYNC_TYPE.FILE }, context))
                .rejects.toThrow(FAILED_TO_FIND_LATEST_DATA_SYNC);
        });
    });

    describe('invalid permission errors', () => {
        const resolvers = {
            listDataSyncs: { submissionID: 'sub-1' },
            getLatestDataSync: { submissionID: 'sub-1', type: DATA_SYNC_TYPE.FILE },
        };

        for (const [resolver, params] of Object.entries(resolvers)) {
            it(`${resolver} rejects a user with no view scope`, async () => {
                const findManySpy = jest.spyOn(dataSyncService.dataSyncDAO, 'findMany');
                const findFirstSpy = jest.spyOn(dataSyncService.dataSyncDAO, 'findFirst');
                submissionService._getUserScope.mockResolvedValue(createScope('none'));

                await expect(submissionService[resolver](params, context))
                    .rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
                expect(findManySpy).not.toHaveBeenCalled();
                expect(findFirstSpy).not.toHaveBeenCalled();
            });

            it(`${resolver} rejects a user whose scope does not cover the submission`, async () => {
                const findManySpy = jest.spyOn(dataSyncService.dataSyncDAO, 'findMany');
                const findFirstSpy = jest.spyOn(dataSyncService.dataSyncDAO, 'findFirst');
                submissionService._getUserScope.mockResolvedValue(createScope('own'));
                context.userInfo._id = 'other-user';

                await expect(submissionService[resolver](params, context))
                    .rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
                expect(findManySpy).not.toHaveBeenCalled();
                expect(findFirstSpy).not.toHaveBeenCalled();
            });

            it(`${resolver} rejects a data-commons user without covering commons`, async () => {
                const findManySpy = jest.spyOn(dataSyncService.dataSyncDAO, 'findMany');
                const findFirstSpy = jest.spyOn(dataSyncService.dataSyncDAO, 'findFirst');
                submissionService._getUserScope.mockResolvedValue(createScope('dc'));

                for (const dataCommons of [undefined, null, [], ['ICDC']]) {
                    context.userInfo.dataCommons = dataCommons;
                    await expect(submissionService[resolver](params, context))
                        .rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
                    expect(findManySpy).not.toHaveBeenCalled();
                    expect(findFirstSpy).not.toHaveBeenCalled();
                }
            });

            it(`${resolver} allows a data-commons user covering the submission`, async () => {
                const findManySpy = jest.spyOn(dataSyncService.dataSyncDAO, 'findMany').mockResolvedValue([]);
                const findFirstSpy = jest.spyOn(dataSyncService.dataSyncDAO, 'findFirst').mockResolvedValue(null);
                submissionService._getUserScope.mockResolvedValue(createScope('dc'));
                context.userInfo.dataCommons = [SUBMISSION.dataCommons];

                await expect(submissionService[resolver](params, context)).resolves.toBeDefined();
                if (resolver === 'listDataSyncs') {
                    expect(findManySpy).toHaveBeenCalled();
                } else {
                    expect(findFirstSpy).toHaveBeenCalled();
                }
            });
        }
    });

    describe('query filters', () => {

        it('listDataSyncs forwards type into findMany', async () => {
            const findManySpy = jest.spyOn(dataSyncService.dataSyncDAO, 'findMany').mockResolvedValue([]);

            await submissionService.listDataSyncs({ submissionID: 'sub-1', type: DATA_SYNC_TYPE.FILE }, context);
            expect(findManySpy).toHaveBeenCalledWith(
                { submissionID: 'sub-1', type: DATA_SYNC_TYPE.FILE },
                { sort: { startTime: -1 } }
            );
        });

        it('listDataSyncs omits type from findMany when type is omitted', async () => {
            const findManySpy = jest.spyOn(dataSyncService.dataSyncDAO, 'findMany').mockResolvedValue([]);

            for (const omittedType of [undefined, null, '']) {
                await submissionService.listDataSyncs({ submissionID: 'sub-1', type: omittedType }, context);
                expect(findManySpy).toHaveBeenLastCalledWith(
                    { submissionID: 'sub-1' },
                    { sort: { startTime: -1 } }
                );
            }
        });

        it('getLatestDataSync forwards type into findFirst', async () => {
            const findFirstSpy = jest.spyOn(dataSyncService.dataSyncDAO, 'findFirst').mockResolvedValue(null);

            await submissionService.getLatestDataSync({ submissionID: 'sub-1', type: DATA_SYNC_TYPE.METADATA }, context);
            expect(findFirstSpy).toHaveBeenCalledWith(
                { submissionID: 'sub-1', type: DATA_SYNC_TYPE.METADATA },
                { sort: { startTime: -1 } }
            );
        });

    });

    describe('invalid input parameters', () => {

        it('reject a missing or unknown submissionID', async () => {
            for (const submissionID of [undefined, null, '', 'unknown']) {
                await expect(submissionService.listDataSyncs({ submissionID }, context))
                    .rejects.toThrow(ERROR.SUBMISSION_NOT_EXIST);
                await expect(submissionService.getLatestDataSync({ submissionID, type: DATA_SYNC_TYPE.FILE }, context))
                    .rejects.toThrow(ERROR.SUBMISSION_NOT_EXIST);
            }
        });

        it('listDataSyncs rejects an invalid type', async () => {
            await expect(submissionService.listDataSyncs({ submissionID: 'sub-1', type: 0 }, context))
                .rejects.toThrow(replaceErrorString(ERROR.FIND_DATA_SYNC_INVALID_TYPE, 'type'));
            await expect(submissionService.listDataSyncs({ submissionID: 'sub-1', type: `${DATA_SYNC_TYPE.FILE}-invalid` }, context))
                .rejects.toThrow(replaceErrorString(ERROR.FIND_DATA_SYNC_INVALID_ENUM, 'type'));
        });

        it('getLatestDataSync rejects a missing or invalid type', async () => {
            for (const missingType of [undefined, null, '']) {
                await expect(submissionService.getLatestDataSync({ submissionID: 'sub-1', type: missingType }, context))
                    .rejects.toThrow(replaceErrorString(ERROR.FIND_DATA_SYNC_MISSING_FIELD, 'type'));
            }
            await expect(submissionService.getLatestDataSync({ submissionID: 'sub-1', type: 0 }, context))
                .rejects.toThrow(replaceErrorString(ERROR.FIND_DATA_SYNC_INVALID_TYPE, 'type'));
            await expect(submissionService.getLatestDataSync({ submissionID: 'sub-1', type: `${DATA_SYNC_TYPE.FILE}-invalid` }, context))
                .rejects.toThrow(replaceErrorString(ERROR.FIND_DATA_SYNC_INVALID_ENUM, 'type'));
        });

    });
});
