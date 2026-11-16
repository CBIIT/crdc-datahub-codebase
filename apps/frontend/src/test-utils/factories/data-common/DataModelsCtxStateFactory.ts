import { DataModelsCtxState } from "../../../components/Contexts/DataModelsContext";
import { Factory } from "../Factory";

/**
 * Base DataModelsCtxState object
 */
export const baseDataModelsCtxState: DataModelsCtxState = {
  status: "LOADED",
  isRefreshing: false,
  models: [],
  visibleModels: [],
};

/**
 * DataModelsCtxState factory for creating DataModelsCtxState instances
 *
 * @note If `visibleModels` is not provided, it is derived from `models`.
 */
export const dataModelsCtxStateFactory = new Factory<DataModelsCtxState>((overrides) => {
  const models = overrides?.models ?? baseDataModelsCtxState.models;

  return {
    ...baseDataModelsCtxState,
    models,
    visibleModels: models.filter((model) => !model.isHidden),
    ...overrides,
  };
});
