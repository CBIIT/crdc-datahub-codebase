import { useMemo } from "react";

import { useDataModels } from "@/components/Contexts/DataModelsContext";
import { HeaderLinks, MODEL_NAVIGATOR_NAV_ID } from "@/config/HeaderConfig";

/**
 * Provides the header navigation links, including the runtime-generated
 * links (e.g. Model Navigator).
 *
 * @note The returned array is memoized and stable until the visible Data Models change.
 * @returns The header navigation links
 */
const useHeaderLinks = (): NavBarItem[] => {
  const { visibleModels } = useDataModels();
  const modelOptions = useMemo<NavBarSubItem[][]>(
    () =>
      visibleModels.map((dc) => [
        {
          id: `model-navigator-${dc.name}`,
          name: `${dc.displayName}${dc.displayName.indexOf("Model") === -1 ? " Model" : ""}`,
          link: `/model-navigator/${dc.displayName}/latest`,
          className: "navMobileSubItem",
        },
      ]),
    [visibleModels]
  );

  return useMemo<NavBarItem[]>(
    () =>
      HeaderLinks.map((link) =>
        link.id === MODEL_NAVIGATOR_NAV_ID ? { ...link, columns: modelOptions } : link
      ),
    [modelOptions]
  );
};

export default useHeaderLinks;
