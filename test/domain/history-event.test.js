jest.mock('../../crdc-datahub-database-drivers/utility/time-utility', () => ({
  getCurrentTime: jest.fn(),
}));

const { getCurrentTime } = require('../../crdc-datahub-database-drivers/utility/time-utility');
const { HistoryEventBuilder } = require('../../domain/history-event');

describe('HistoryEventBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be backward compatible and use current time when dateTime is omitted', () => {
    const mockedNow = new Date('2026-04-07T12:00:00.000Z');
    getCurrentTime.mockReturnValue(mockedNow);

    const event = HistoryEventBuilder.createEvent('user-1', 'New', 'hello');

    expect(getCurrentTime).toHaveBeenCalledTimes(1);
    expect(event).toEqual({
      userID: 'user-1',
      status: 'New',
      reviewComment: 'hello',
      dateTime: mockedNow,
    });
  });

  it.each([null, "xyz", 123, undefined])("should ignore the provided datetime when it's not a Date object (value: %p)", (invalidDate) => {
    const mockedNow = new Date('2026-04-07T12:00:00.000Z');
    getCurrentTime.mockReturnValue(mockedNow);

    const event = HistoryEventBuilder.createEvent('user-1', 'New', 'hello', invalidDate);

    expect(getCurrentTime).toHaveBeenCalledTimes(1);
    expect(event).toEqual({
      userID: 'user-1',
      status: 'New',
      reviewComment: 'hello',
      dateTime: mockedNow,
    });
  });

  it('should use the provided dateTime when it is a Date object', () => {
    const providedDate = new Date('2026-04-07T12:00:02.000Z');

    const event = HistoryEventBuilder.createEvent('user-2', 'In Review', null, providedDate);

    expect(getCurrentTime).not.toHaveBeenCalled();
    expect(event).toEqual({
      userID: 'user-2',
      status: 'In Review',
      dateTime: providedDate,
    });
  });

  // NOTE: This behavior is very likely undesirable. But I'm leaving it unchanged.
  it('should preserve existing field validation behavior', () => {
    const mockedNow = new Date('2026-04-07T12:00:03.000Z');
    getCurrentTime.mockReturnValue(mockedNow);

    const event = HistoryEventBuilder.createEvent(null, '', '');

    expect(event).toEqual({ dateTime: mockedNow });
  });
});
