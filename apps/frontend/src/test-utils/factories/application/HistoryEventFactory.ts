import { Factory } from "../Factory";

/**
 * Base history event object
 */
export const baseHistoryEvent: HistoryEvent = {
  status: "New",
  dateTime: "",
  userID: "",
};

/**
 * History event factory for creating history event instances
 */
export const historyEventFactory = new Factory<HistoryEvent>((overrides) => ({
  ...baseHistoryEvent,
  ...overrides,
}));
