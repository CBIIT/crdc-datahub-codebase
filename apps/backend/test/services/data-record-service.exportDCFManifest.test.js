const { DataRecordService } = require('../../services/data-record-service');

describe('DataRecordService.exportDCFManifest', () => {
  let dataRecordService;
  let mockAwsService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAwsService = {
      sendSQSMessage: jest.fn().mockResolvedValue({})
    };

    dataRecordService = new DataRecordService(
      {}, 'file-queue', 'metadata-queue',
      mockAwsService, {}, {}, 'export-queue', null
    );
  });

  it('sends a message with type "Export DCF Manifest" to the export queue', async () => {
    await dataRecordService.exportDCFManifest('sub-123');

    expect(mockAwsService.sendSQSMessage).toHaveBeenCalledTimes(1);
    const [msg] = mockAwsService.sendSQSMessage.mock.calls[0];
    expect(msg.type).toBe('Export DCF Manifest');
    expect(msg.submissionID).toBe('sub-123');
  });

  it('sends to the export queue, not the metadata queue', async () => {
    await dataRecordService.exportDCFManifest('sub-123');

    const queueArg = mockAwsService.sendSQSMessage.mock.calls[0][3];
    expect(queueArg).toBe('export-queue');
  });

  it('does not send an "Export Metadata" message', async () => {
    await dataRecordService.exportDCFManifest('sub-123');

    const [msg] = mockAwsService.sendSQSMessage.mock.calls[0];
    expect(msg.type).not.toBe('Export Metadata');
  });
});
