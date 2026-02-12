/* eslint-disable @typescript-eslint/no-empty-interface */
import "vitest";
import type { AxeMatchers } from "vitest-axe/matchers";

interface CustomMatchers<R = unknown> {
  toBeFoo: () => R;
}

declare module "vitest" {
  export interface Assertion extends AxeMatchers {}
  export interface AsymmetricMatchersContaining extends AxeMatchers {}
}
