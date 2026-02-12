import { Factory } from "../Factory";

/**
 * Base pie sector data item object
 */
export const basePieSectorDataItem: PieSectorDataItem = {
  label: "New",
  value: 0,
  color: "",
};

/**
 * Pie sector data item factory for creating pie sector data item instances
 */
export const pieSectorDataItemFactory = new Factory<PieSectorDataItem>((overrides) => ({
  ...basePieSectorDataItem,
  ...overrides,
}));
