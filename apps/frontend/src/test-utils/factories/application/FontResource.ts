import { FontResource } from "@/components/ExportRequestButton/pdf/Fonts";

import { Factory } from "../Factory";

/**
 * Base font resource object
 */
export const baseFontResource: FontResource = {
  src: "",
  family: "",
  style: "",
  fontWeight: 0,
};

/**
 * Font resource factory for creating font resource instances
 */
export const fontResourceFactory = new Factory<FontResource>((overrides) => ({
  ...baseFontResource,
  ...overrides,
}));
