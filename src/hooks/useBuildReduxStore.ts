import { useLazyQuery } from "@apollo/client";
import {
  ddgraph,
  moduleReducers as submission,
  versionInfo,
  changelogInfo,
  iconMapInfo,
  getModelExploreData,
  getChangelog,
} from "data-model-navigator";
import { useState } from "react";
import { createStore, combineReducers, Store } from "redux";

import logo from "../assets/header/Logo.jpg";
import { baseConfiguration, defaultReadMeTitle, graphViewConfig } from "../config/ModelNavigator";
import {
  RETRIEVE_PVS_BY_PROPERTY_NAME,
  RetrievePVsByPropertyNameInput,
  RetrievePVsByPropertyNameResponse,
} from "../graphql";
import {
  buildAssetUrls,
  buildBaseFilterContainers,
  buildFilterOptionsList,
  extractModelProperties,
  Logger,
  populatePermissibleValues,
} from "../utils";

export type ReduxStoreStatus = "waiting" | "loading" | "error" | "success";

export type ReduxStoreData = {
  /**
   * The current status of the Redux store.
   */
  status: ReduxStoreStatus;
  /**
   * The Redux store instance.
   */
  store: Store;
};

export type ReduxStoreResult = [ReduxStoreData, (assets: DataCommon, modelVersion: string) => void];

const makeStore = (): Store => {
  const reducers = { ddgraph, versionInfo, submission, changelogInfo, iconMapInfo };
  const newStore = createStore(combineReducers(reducers));

  // @ts-ignore
  newStore.injectReducer = (key, reducer) => {
    reducers[key] = reducer;
    newStore.replaceReducer(combineReducers(reducers));
  };

  return newStore;
};

/**
 * A hook to build and populate the Redux store with DMN data
 *
 * @params {void}
 */
const useBuildReduxStore = (): ReduxStoreResult => {
  const [store] = useState<Store>(makeStore());
  const [status, setStatus] = useState<ReduxStoreStatus>("waiting");

  const [retrievePVs] = useLazyQuery<
    RetrievePVsByPropertyNameResponse,
    RetrievePVsByPropertyNameInput
  >(RETRIEVE_PVS_BY_PROPERTY_NAME, {
    context: { clientName: "backend" },
    fetchPolicy: "cache-first",
  });

  /**
   * Injects the Data Model into the store
   *
   * @param datacommon The Data Model to inject assets from
   * @param modelVersion The version of the Data Model to inject
   */
  const populateStore = async (datacommon: DataCommon, modelVersion: string) => {
    if (
      !datacommon?.name ||
      !datacommon?.assets ||
      !datacommon?.assets["current-version"] ||
      !datacommon?.assets["model-navigator-config"]
    ) {
      setStatus("error");
      return;
    }

    setStatus("loading");

    const assets = buildAssetUrls(datacommon, modelVersion);
    const dmnConfig = datacommon.assets["model-navigator-config"];

    const [changelogMD, modelData] = await Promise.allSettled([
      getChangelog(assets?.changelog),
      getModelExploreData(...assets.model_files),
    ]).then((results) =>
      results.map((result) => {
        if (result.status === "fulfilled") {
          return result.value;
        }

        Logger.error("Received error during Model Navigator store building", result.reason);
        return null;
      })
    );

    const { data: dictionary, version: versionData } = modelData || {};
    if (!dictionary || !versionData) {
      setStatus("error");
      return;
    }

    const allProperties = extractModelProperties(dictionary);
    try {
      const { data, error } = await retrievePVs({
        variables: {
          modelName: datacommon.name,
          modelVersion: versionData?.model,
          propertyNames: allProperties,
        },
      });

      if (error || !data?.retrievePVsByPropertyName?.length) {
        throw new Error(error?.message || "No permissible values returned by the API");
      }

      populatePermissibleValues(dictionary, allProperties, data.retrievePVsByPropertyName);
    } catch (error) {
      Logger.error("populateStore: Received an error while retrieving permissible values", error);
      populatePermissibleValues(dictionary, allProperties, []);
    }

    store.dispatch({ type: "RECEIVE_VERSION_INFO", data: versionData });

    store.dispatch({
      type: "REACT_FLOW_GRAPH_DICTIONARY",
      dictionary,
      pdfDownloadConfig: {
        iconSrc: logo,
        ...dmnConfig.pdfConfig,
      },
      graphViewConfig,
    });

    store.dispatch({
      type: "RECEIVE_DICTIONARY",
      payload: {
        data: dictionary,
        facetfilterConfig: {
          ...baseConfiguration,
          facetSearchData: dmnConfig.facetFilterSearchData,
          facetSectionVariables: dmnConfig.facetFilterSectionVariables,
          baseFilters: buildBaseFilterContainers(dmnConfig),
          filterSections: dmnConfig.facetFilterSearchData.map((s) => s?.datafield),
          filterOptions: buildFilterOptionsList(dmnConfig),
        },
        pageConfig: {
          title: dmnConfig.pageTitle,
          iconSrc: assets.navigator_icon,
        },
        readMeConfig: {
          readMeUrl: assets.readme,
          readMeTitle: dmnConfig?.readMeTitle || defaultReadMeTitle,
          allowDownload: false,
        },
        pdfDownloadConfig: dmnConfig.pdfConfig,
        loadingExampleConfig: {
          type: "static",
          url: assets.loading_file,
        },
      },
    });

    if (changelogMD) {
      store.dispatch({
        type: "RECEIVE_CHANGELOG_INFO",
        data: {
          changelogMD,
          changelogTabName: "Version History",
        },
      });
    }

    if (datacommon?.assets?.["model-navigator-config"]?.iconMap) {
      store.dispatch({
        type: "RECEIVE_ICON_MAP",
        data: datacommon?.assets?.["model-navigator-config"]?.iconMap,
      });
    }

    // MVP-2 M2 NOTE: This resets the search history to prevent the data models
    // from overlapping on searches. A future improvement would be to isolate
    // the localStorage history key to the data model based on a config option.
    store.dispatch({ type: "SEARCH_CLEAR_HISTORY" });

    setStatus("success");
  };

  return [{ status, store }, populateStore];
};

export default useBuildReduxStore;
