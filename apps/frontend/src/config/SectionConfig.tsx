import A from "../content/questionnaire/sections/A";
import B from "../content/questionnaire/sections/B";
import C from "../content/questionnaire/sections/C";
import D from "../content/questionnaire/sections/D";
import Review from "../content/questionnaire/sections/Review";

import sectionMetadata from "./SectionMetadata";

/**
 * Configuration and mapping for Questionnaire Sections
 *
 * NOTE:
 * - The sections are rendered and navigated in the order they are defined here
 *
 * @see SectionConfig
 */
const sections: SectionConfig = {
  A: {
    ...sectionMetadata.A,
    component: A,
  },
  B: {
    ...sectionMetadata.B,
    component: B,
  },
  C: {
    ...sectionMetadata.C,
    component: C,
  },
  D: {
    ...sectionMetadata.D,
    component: D,
  },
  REVIEW: {
    ...sectionMetadata.REVIEW,
    component: Review,
  },
};

export const InitialSections: Section[] = Object.keys(sections)
  ?.slice(0, -1)
  ?.map((sectionKey) => ({
    name: sections[sectionKey].id,
    status: "Not Started",
  }));

export default sections;
