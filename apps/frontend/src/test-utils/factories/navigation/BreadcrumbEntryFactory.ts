import { BreadcrumbEntry } from "@/components/NavigationBreadcrumbs";

import { Factory } from "../Factory";

/**
 * Base breadcrumb entry object
 */
export const baseBreadcrumbEntry: BreadcrumbEntry = {
  label: "",
  to: undefined,
};

/**
 * Breadcrumb entry factory for creating breadcrumb entry instances
 */
export const breadcrumbEntryFactory = new Factory<BreadcrumbEntry>((overrides) => ({
  ...baseBreadcrumbEntry,
  ...overrides,
}));
