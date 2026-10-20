import { describe, expect, it } from "vitest";

import { getViewportHeightPx } from "./viewportUtils";

describe("getViewportHeightPx", () => {
  it("should return window.innerHeight when window is available", () => {
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const result = getViewportHeightPx(500);

    expect(result).toBe(1024);

    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
  });

  it("should return fallback value when different window height is set", () => {
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 768,
    });

    const result = getViewportHeightPx(500);

    expect(result).toBe(768);

    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
  });

  it("should return fallback value when window is undefined", () => {
    const originalWindow = global.window;
    delete global.window;

    const result = getViewportHeightPx(500);

    expect(result).toBe(500);

    global.window = originalWindow;
  });
});
