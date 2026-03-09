import { Factory } from "../Factory";

import { approvedStudyFactory } from "./ApprovedStudyFactory";

/**
 * Base released study object
 */
export const baseReleasedStudy: ReleasedStudy = {
  ...approvedStudyFactory.pick(["_id", "studyName", "dbGaPID", "studyAbbreviation"]).build(),
  dataCommons: [],
  dataCommonsDisplayNames: [],
};

/**
 * Released study factory for creating released study instances
 */
export const releasedStudyFactory = new Factory<ReleasedStudy>((overrides) => ({
  ...baseReleasedStudy,
  ...overrides,
}));
