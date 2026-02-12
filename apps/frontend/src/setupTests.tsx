/* eslint-disable max-classes-per-file */
import "@testing-library/jest-dom/vitest";
import { config } from "react-transition-group";
import { expect, vi } from "vitest";
import { configureAxe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";
import "vitest-canvas-mock";
import failOnConsole from "vitest-fail-on-console";

expect.extend(matchers);

// Disable transitions
config.disabled = true;

// See https://github.com/NickColley/jest-axe/issues/147
configureAxe({
  globalOptions: {
    checks: [
      {
        id: "color-contrast",
        enabled: false,
      },
    ],
  },
});

/**
 * Mocks the enqueueSnackbar function from notistack for testing
 *
 * @note You must RESET all mocks after each test to avoid unexpected behavior
 * @example expect(global.mockEnqueue).toHaveBeenCalledWith('message', { variant: 'error' });
 * @see notistack documentation: https://notistack.com/getting-started
 */
global.mockEnqueue = vi.fn();
vi.mock("notistack", async () => ({
  ...(await vi.importActual("notistack")),
  useSnackbar: () => ({ enqueueSnackbar: global.mockEnqueue }),
}));

/**
 * Mocks the DataTransfer class for testing as it is not available in JSDOM
 *
 * @note This only implements the underlying data structure and `files()` method
 * @see MDN documentation: https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer
 */
global.DataTransfer = class DataTransfer {
  items = null;

  constructor() {
    this.items = new (class {
      array: unknown[];

      constructor() {
        this.array = [];
      }

      add(file) {
        this.array.push(file);
      }

      get length() {
        return this.array.length;
      }
    })();
  }

  get files() {
    return this.items.array;
  }
} as typeof DataTransfer;

/**
 * Mocks the Recharts ResponsiveContainer component for testing
 *
 * @note This solves the missing ResizeObserver error in Jest
 * @see Recharts documentation: https://recharts.org/en-US/guide
 */
const MockResponsiveContainer = (props) => <div {...props} />;
vi.mock("recharts", async () => ({
  ...(await vi.importActual("recharts")),
  ResponsiveContainer: MockResponsiveContainer,
}));

/**
 * Prevents the console.error and console.warn from silently failing
 * in tests by throwing an error when called
 */
failOnConsole({
  shouldFailOnWarn: true,
  shouldFailOnError: true,
});
