/* eslint-disable import/no-extraneous-dependencies */
import { Box } from "@mui/material";
import { ReduxDataDictionary } from "data-model-navigator";
import _ from "lodash";
import { FC } from "react";
import { Provider } from "react-redux";

import { Status, useDataCommonContext } from "../../components/Contexts/DataCommonContext";
import SuspenseLoader from "../../components/SuspenseLoader";
import useBuildReduxStore from "../../hooks/useBuildReduxStore";

// NOTE: This is required for Model Navigator to work
globalThis._ = _;

type ModelNavigatorProps = {
  /**
   * The version of the model to display
   */
  version: string;
};

/**
 * Encapsulates the Data Model Navigator component
 *
 * This component handles the following:
 * - Loading the Data Common assets
 * - Building the Redux store for the Data Model Navigator
 * - Rendering the Data Model Navigator
 *
 * @returns The Model Navigator view
 */
const ModelNavigator: FC<ModelNavigatorProps> = ({ version = "latest" }) => {
  const { status, DataCommon } = useDataCommonContext();
  const [{ status: buildStatus, store }, populate] = useBuildReduxStore();

  if (status === Status.LOADING || buildStatus === "loading") {
    return <SuspenseLoader />;
  }

  if (status === Status.LOADED && buildStatus === "waiting") {
    populate(DataCommon, version);
    return <SuspenseLoader />;
  }

  if (!DataCommon || status === Status.ERROR || buildStatus === "error") {
    throw new Error("Oops! Unable to show the requested data model or model version.");
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
