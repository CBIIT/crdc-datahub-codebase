import { Factory } from "../Factory";

/**
 * Base study object
 */
export const baseStudy: Study = {
  name: "",
  abbreviation: "",
  description: "",
  publications: [],
  plannedPublications: [],
  repositories: [],
  funding: [],
  isDbGapRegistered: false,
  dbGaPPPHSNumber: "",
  GPAName: "",
};

/**
 * Study factory for creating study instances
 */
export const studyFactory = new Factory<Study>((overrides) => ({
  ...baseStudy,
  ...overrides,
}));
