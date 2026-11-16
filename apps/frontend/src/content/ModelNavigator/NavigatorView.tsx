/* eslint-disable import/no-extraneous-dependencies */
import { Box } from "@mui/material";
import { ReduxDataDictionary } from "data-model-navigator";
import _ from "lodash";
import { FC, useMemo } from "react";
import { Provider } from "react-redux";

import { useDataModels } from "@/components/Contexts/DataModelsContext";
import SuspenseLoader from "@/components/SuspenseLoader";
import useBuildReduxStore from "@/hooks/useBuildReduxStore";

// NOTE: This is required for Model Navigator to work
globalThis._ = _;

type ModelNavigatorProps = {
  /**
   * The display name of the model to display
   */
  model: string;
  /**
   * The version of the model to display
   */
  version: string;
};

/**
 * Encapsulates the Data Model Navigator component
 *
 * This component handles the following:
 * - Waiting for the latest model manifest, so a stale cached manifest is never built or rejected
 * - Loading the Data Common assets
 * - Building the Redux store for the Data Model Navigator
 * - Rendering the Data Model Navigator
 *
 * @returns The Model Navigator view
 */
const ModelNavigator: FC<ModelNavigatorProps> = ({ model, version = "latest" }) => {
  const { isRefreshing, visibleModels } = useDataModels();
  const [{ status: buildStatus, store }, populate] = useBuildReduxStore();

  const dataCommon = useMemo<DataCommon | undefined>(
    () => visibleModels.find((dc) => dc.displayName === model),
    [visibleModels, model]
  );

  if (isRefreshing || buildStatus === "loading") {
    return <SuspenseLoader />;
  }

  if (!dataCommon || buildStatus === "error") {
    throw new Error("Oops! Unable to show the requested data model or model version.");
  }

  if (buildStatus === "waiting") {
    populate(dataCommon, version);
    return <SuspenseLoader />;
  }

  return (
    <Box sx={{ mt: "40px" }}>
      <Provider store={store}>
        <ReduxDataDictionary />
      </Provider>
    </Box>
  );
};

export default ModelNavigator;
