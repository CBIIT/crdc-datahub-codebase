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
import { RETRIEVE_CDEs, RetrieveCDEsInput, RetrieveCDEsResp } from "../graphql";
import {
  buildAssetUrls,
  buildBaseFilterContainers,
  buildFilterOptionsList,
  Logger,
  extractSupportedCDEs,
  populateCDEData,
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

  const [retrieveCDEs] = useLazyQuery<RetrieveCDEsResp, RetrieveCDEsInput>(RETRIEVE_CDEs, {
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

    const { data: dictionary, version } = modelData || {};
    if (!dictionary || !version) {
      setStatus("error");
      return;
    }

    const allCDEs = extractSupportedCDEs(dictionary);
    if (allCDEs.length > 0) {
      try {
        const CDEs = await retrieveCDEs({
          variables: {
            cdeInfo: allCDEs.map(({ CDECode, CDEVersion }) => ({ CDECode, CDEVersion })),
          },
        });
        populateCDEData(dictionary, CDEs?.data?.retrieveCDEs || []);
      } catch (error) {
        populateCDEData(dictionary, []);
      }
    }

    store.dispatch({ type: "RECEIVE_VERSION_INFO", data: version });

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
