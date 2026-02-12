import React, { createElement } from "react";

import config from "../../../config/SectionConfig";

type Props = Omit<FormSectionProps, "SectionOption"> & {
  section: string;
};

/**
 * Generate the correct section component based on the section name
 *
 * NOTE:
 * - This component is not rendered until we have form data
 *   status validation is NOT needed
 *
 * @param {Props} props
 * @returns {FunctionComponentElement} - Section component
 */
const SectionMap = ({ section, ...rest }: Props) => {
  const sectionName = section.toUpperCase();
  const sectionConfig = config[sectionName];

  // Create the section component
  if (typeof sectionConfig !== "undefined" && sectionConfig.component) {
    return createElement(sectionConfig.component, {
      SectionOption: sectionConfig,
      ...rest,
    });
  }

  // Render a fallback component if the section is not found
  // Note: Validation should prevent this from ever happening
  return createElement(() => <div>Oops! Form section not found</div>);
};

export default SectionMap;
