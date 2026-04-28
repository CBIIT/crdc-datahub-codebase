/**
 * Data View (getSubmissionNodes) builds `properties` from _processSubmissionNodes.
 * Column names are the union of the current page, distinct parent relationship keys
 * (`getDistinctParentRelationshipKeys`), and distinct top-level `props` keys
 * (`getDistinctPropsTopLevelKeys`), all for rows matching the list filter. The final
 * `properties` array is sorted alphabetically.
 *
 * @see services/submission.js — _processSubmissionNodes, listSubmissionNodes
 */

const { Submission } = require('../../services/submission');
const { VALIDATION_STATUS } = require('../../constants/submission-constants');
const { verifySession } = require('../../verifier/user-info-verifier');

jest.mock('../../verifier/user-info-verifier', () => ({
  verifySession: jest.fn()
}));

const REL_SAMPLE = 'sample.sample_id';
const REL_PARTICIPANT = 'participant.study_participant_id';

function createMockUserScope(allowView = true) {
  return {
    isNoneScope: jest.fn().mockReturnValue(!allowView)
  };
}

function baseNode(overrides = {}) {
  return {
    submissionID: 'sub-1',
    nodeType: 'study_diagnosis',
    nodeID: 'sd-1',
    IDPropName: 'study_diagnosis_id',
    status: VALIDATION_STATUS.PASSED,
    props: { study_diagnosis_id: 'SD1' },
    parents: [],
    orginalFileName: 'diagnosis.tsv',
    lineNumber: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

function buildSubmissionService() {
  const mockOrganizationService = { organizationCollection: {} };
  const submissionService = new Submission(
    {},
    {},
    {},
    {},
    mockOrganizationService,
    {},
    {},
    jest.fn(),
    {},
    'test-queue',
    {},
    {},
    [],
    [],
    {},
    'test-loader',
    {},
    {},
    'test-bucket',
    {},
    {},
    new Map(),
    {},
    {},
    {}
  );
  return submissionService;
}

describe('Submission _processSubmissionNodes (Data View properties)', () => {
  let submissionService;

  beforeEach(() => {
    jest.clearAllMocks();
    verifySession.mockReturnValue({
      verifyInitialized: jest.fn()
    });
    submissionService = buildSubmissionService();
  });

  it('includes both relationship keys when the current page has both parent patterns', () => {
    const withSample = baseNode({
      nodeID: 'sd-1',
      parents: [
        { parentType: 'sample', parentIDPropName: 'sample_id', parentIDValue: 'SAM1' }
      ],
      props: { study_diagnosis_id: 'SD1' }
    });
    const withParticipant = baseNode({
      nodeID: 'sd-2',
      parents: [
        {
          parentType: 'participant',
          parentIDPropName: 'study_participant_id',
          parentIDValue: 'P1'
        }
      ],
      props: { study_diagnosis_id: 'SD2' }
    });

    const out = submissionService._processSubmissionNodes({
      total: 2,
      results: [withSample, withParticipant]
    });

    expect(out.properties).toEqual([
      REL_PARTICIPANT,
      REL_SAMPLE,
      'study_diagnosis_id'
    ]);
    expect(out.total).toBe(2);
  });

  it('includes both relationship keys on a single row when parents lists two parent types', () => {
    const bothParents = baseNode({
      nodeID: 'sd-both',
      parents: [
        { parentType: 'sample', parentIDPropName: 'sample_id', parentIDValue: 'SAM1' },
        {
          parentType: 'participant',
          parentIDPropName: 'study_participant_id',
          parentIDValue: 'P1'
        }
      ],
      props: { study_diagnosis_id: 'SDBOTH' }
    });

    const out = submissionService._processSubmissionNodes({
      total: 1,
      results: [bothParents]
    });

    expect(out.properties).toEqual([
      REL_PARTICIPANT,
      REL_SAMPLE,
      'study_diagnosis_id'
    ]);
    expect(out.total).toBe(1);
  });

  it('merges submission-wide relationship keys so columns include parents not on the current page', () => {
    // Page: only sample parents; third arg mirrors submission-wide keys (e.g. other pages have
    // participant links).
    const pageNodes = [
      baseNode({
        nodeID: 'sd-a',
        parents: [
          { parentType: 'sample', parentIDPropName: 'sample_id', parentIDValue: 'SAM1' }
        ],
        props: { study_diagnosis_id: 'SDA' }
      }),
      baseNode({
        nodeID: 'sd-b',
        parents: [
          { parentType: 'sample', parentIDPropName: 'sample_id', parentIDValue: 'SAM2' }
        ],
        props: { study_diagnosis_id: 'SDB' }
      })
    ];

    const out = submissionService._processSubmissionNodes(
      { total: 200, results: pageNodes },
      null,
      [REL_PARTICIPANT]
    );

    expect(out.properties).toEqual([
      REL_PARTICIPANT,
      REL_SAMPLE,
      'study_diagnosis_id'
    ]);
  });
});

describe('Submission listSubmissionNodes (Data View, paginated path)', () => {
  let submissionService;
  const mockSubmission = {
    _id: 'sub-1',
    bucketName: 'b',
    rootPath: 'p'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    verifySession.mockReturnValue({
      verifyInitialized: jest.fn()
    });
    submissionService = buildSubmissionService();
    submissionService._findByID = jest.fn().mockResolvedValue(mockSubmission);
    submissionService._getUserScope = jest.fn().mockResolvedValue(createMockUserScope(true));
  });

  it('merges distinct relationship keys, distinct props keys, and the current page for listSubmissionNodes', async () => {
    const sampleOnlyPage = {
      total: 200,
      results: [
        baseNode({
          nodeID: 'sd-1',
          parents: [
            { parentType: 'sample', parentIDPropName: 'sample_id', parentIDValue: 'SAM1' }
          ],
          props: { study_diagnosis_id: 'SD1' }
        })
      ]
    };

    submissionService.dataRecordDAO.getSubmissionNodes = jest
      .fn()
      .mockResolvedValue(sampleOnlyPage);
    submissionService.dataRecordDAO.getDistinctParentRelationshipKeys = jest
      .fn()
      .mockResolvedValue([REL_SAMPLE, REL_PARTICIPANT]);
    submissionService.dataRecordDAO.getDistinctPropsTopLevelKeys = jest
      .fn()
      .mockResolvedValue([]);

    const params = {
      submissionID: 'sub-1',
      nodeType: 'study_diagnosis',
      status: 'All',
      first: 10,
      offset: 0,
      orderBy: 'nodeID',
      sortDirection: 'ASC'
    };
    const context = { userInfo: { _id: 'u1' } };

    const out = await submissionService.listSubmissionNodes(params, context);

    expect(submissionService.dataRecordDAO.getSubmissionNodes).toHaveBeenCalledWith(
      'sub-1',
      'study_diagnosis',
      10,
      0,
      'nodeID',
      'ASC',
      expect.objectContaining({
        submissionID: 'sub-1',
        nodeType: 'study_diagnosis'
      })
    );
    expect(submissionService.dataRecordDAO.getDistinctParentRelationshipKeys).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionID: 'sub-1',
        nodeType: 'study_diagnosis'
      })
    );
    expect(submissionService.dataRecordDAO.getDistinctPropsTopLevelKeys).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionID: 'sub-1',
        nodeType: 'study_diagnosis'
      })
    );

    expect(out.properties).toEqual([
      REL_PARTICIPANT,
      REL_SAMPLE,
      'study_diagnosis_id'
    ]);
  });

  it('includes top-level props keys from getDistinctPropsTopLevelKeys when absent on the current page', async () => {
    submissionService.dataRecordDAO.getSubmissionNodes = jest.fn().mockResolvedValue({
      total: 200,
      results: [
        baseNode({
          nodeID: 'sd-1',
          parents: [
            { parentType: 'sample', parentIDPropName: 'sample_id', parentIDValue: 'SAM1' }
          ],
          props: { study_diagnosis_id: 'SD1' }
        })
      ]
    });
    submissionService.dataRecordDAO.getDistinctParentRelationshipKeys = jest.fn().mockResolvedValue([]);
    submissionService.dataRecordDAO.getDistinctPropsTopLevelKeys = jest
      .fn()
      .mockResolvedValue(['only_on_another_page']);

    const out = await submissionService.listSubmissionNodes(
      {
        submissionID: 'sub-1',
        nodeType: 'study_diagnosis',
        status: 'All',
        first: 10,
        offset: 0,
        orderBy: 'nodeID',
        sortDirection: 'ASC'
      },
      { userInfo: { _id: 'u1' } }
    );

    expect(out.properties).toEqual([
      'only_on_another_page',
      REL_SAMPLE,
      'study_diagnosis_id'
    ]);
  });

  it('rejects when getDistinctParentRelationshipKeys fails (Promise.all propagates)', async () => {
    submissionService.dataRecordDAO.getSubmissionNodes = jest.fn().mockResolvedValue({
      total: 0,
      results: []
    });
    submissionService.dataRecordDAO.getDistinctParentRelationshipKeys = jest
      .fn()
      .mockRejectedValue(new Error('aggregate failed'));
    submissionService.dataRecordDAO.getDistinctPropsTopLevelKeys = jest.fn().mockResolvedValue([]);

    await expect(
      submissionService.listSubmissionNodes(
        {
          submissionID: 'sub-1',
          nodeType: 'study_diagnosis',
          status: 'All',
          first: 10,
          offset: 0,
          orderBy: 'nodeID',
          sortDirection: 'ASC'
        },
        { userInfo: { _id: 'u1' } }
      )
    ).rejects.toThrow('aggregate failed');
  });
});
