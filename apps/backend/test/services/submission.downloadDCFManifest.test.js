const { Submission } = require('../../services/submission');
const { SUBMITTED, RELEASED, COMPLETED, NEW, IN_PROGRESS } = require('../../constants/submission-constants');
const ERROR = require('../../constants/error-constants');
const USER_PERMISSION_CONSTANTS = require('../../crdc-datahub-database-drivers/constants/user-permission-constants');

describe('Submission.downloadDCFManifest', () => {
  let submissionService;
  let mockS3Service;

  const mockSubmission = {
    _id: 'sub-123',
    status: SUBMITTED,
    bucketName: 'test-bucket',
    rootPath: 'submissions/sub-123'
  };

  const mockContext = {
    userInfo: { _id: 'user-123', role: 'Data Commons Personnel' }
  };

  const reviewScope = { isNoneScope: jest.fn().mockReturnValue(false) };
  const noReviewScope = { isNoneScope: jest.fn().mockReturnValue(true) };

  beforeEach(() => {
    jest.clearAllMocks();

    mockS3Service = {
      listFile: jest.fn(),
      createDownloadSignedURL: jest.fn()
    };

    submissionService = new Submission(
      {}, {}, {}, {}, { organizationCollection: {} }, {}, {}, jest.fn(),
      {}, 'meta-queue', mockS3Service, {}, [], [], {}, 'loader-queue',
      {}, {}, 'test-bucket', {}, {}, new Map(), {}, {}, {}
    );

    submissionService._findByID = jest.fn();
    submissionService._getUserScope = jest.fn();
  });

  it('throws when submission does not exist', async () => {
    submissionService._findByID.mockResolvedValue(null);

    await expect(submissionService.downloadDCFManifest({ submissionID: 'sub-123' }, mockContext))
      .rejects.toThrow(ERROR.SUBMISSION_NOT_EXIST);
  });

  it('throws when user does not have review permission', async () => {
    submissionService._findByID.mockResolvedValue(mockSubmission);
    submissionService._getUserScope.mockResolvedValue(noReviewScope);

    await expect(submissionService.downloadDCFManifest({ submissionID: 'sub-123' }, mockContext))
      .rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);

    expect(submissionService._getUserScope).toHaveBeenCalledWith(
      mockContext.userInfo,
      USER_PERMISSION_CONSTANTS.DATA_SUBMISSION.REVIEW,
      mockSubmission
    );
  });

  it.each([NEW, IN_PROGRESS])('throws for pre-submit status %s', async (status) => {
    submissionService._findByID.mockResolvedValue({ ...mockSubmission, status });
    submissionService._getUserScope.mockResolvedValue(reviewScope);

    await expect(submissionService.downloadDCFManifest({ submissionID: 'sub-123' }, mockContext))
      .rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
  });

  it('throws DCF_MANIFEST_NOT_AVAILABLE when file is not yet in S3', async () => {
    submissionService._findByID.mockResolvedValue(mockSubmission);
    submissionService._getUserScope.mockResolvedValue(reviewScope);
    mockS3Service.listFile.mockResolvedValue({ Contents: [] });

    await expect(submissionService.downloadDCFManifest({ submissionID: 'sub-123' }, mockContext))
      .rejects.toThrow(ERROR.DCF_MANIFEST_NOT_AVAILABLE);

    expect(mockS3Service.listFile).toHaveBeenCalledWith(
      mockSubmission.bucketName,
      `${mockSubmission.rootPath}/dcf_manifest.tsv`
    );
  });

  it.each([SUBMITTED, RELEASED, COMPLETED])('returns presigned URL for status %s', async (status) => {
    const presignedUrl = 'https://s3.example.com/signed-url';
    submissionService._findByID.mockResolvedValue({ ...mockSubmission, status });
    submissionService._getUserScope.mockResolvedValue(reviewScope);
    mockS3Service.listFile.mockResolvedValue({ Contents: [{ Key: 'submissions/sub-123/dcf_manifest.tsv' }] });
    mockS3Service.createDownloadSignedURL.mockResolvedValue(presignedUrl);

    const result = await submissionService.downloadDCFManifest({ submissionID: 'sub-123' }, mockContext);

    expect(result).toBe(presignedUrl);
    expect(mockS3Service.createDownloadSignedURL).toHaveBeenCalledWith(
      mockSubmission.bucketName,
      mockSubmission.rootPath,
      'dcf_manifest.tsv',
      'dcf_manifest.tsv'
    );
  });
});
