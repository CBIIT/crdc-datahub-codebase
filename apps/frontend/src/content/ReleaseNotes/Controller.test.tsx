import { act, render, waitFor } from "../../test-utils";
import { Logger } from "../../utils";

import Controller from "./Controller";

vi.spyOn(Logger, "error").mockImplementation(() => vi.fn());

const mockFetchReleaseNotes = vi.fn();
vi.mock("../../utils", async () => ({
  ...(await vi.importActual("../../utils")),
  fetchReleaseNotes: async (...p) => mockFetchReleaseNotes(...p),
}));

const mockUsePageTitle = vi.fn();
vi.mock("../../hooks/usePageTitle", async () => ({
  ...(await vi.importActual("../../hooks/usePageTitle")),
  default: (...p) => mockUsePageTitle(...p),
}));

describe("Basic Functionality", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllTimers();
  });

  it("should set the page title 'Release Notes'", async () => {
    render(<Controller />);

    await waitFor(() => {
      expect(mockUsePageTitle).toHaveBeenCalledWith("Release Notes");
    });
  });

  it("should render the loader when fetching release notes", async () => {
    vi.useFakeTimers();

    mockFetchReleaseNotes.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve("# Mock Markdown Data");
          }, 20000); // This never really needs to resolve for the test
        })
    );

    const { getByLabelText } = render(<Controller />);

    await waitFor(() => {
      expect(getByLabelText("Content Loader")).toBeInTheDocument();
    });
  });

  it("should fetch release notes on mount", async () => {
    render(<Controller />);

    await waitFor(() => {
      expect(mockFetchReleaseNotes).toHaveBeenCalledTimes(1);
    });
  });

  it("should render the notes when release notes are fetched", async () => {
    vi.useFakeTimers();

    mockFetchReleaseNotes.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve("# Mock Markdown Data");
          }, 500);
        })
    );

    const { getByText, queryByText } = render(<Controller />);

    expect(queryByText(/Mock Markdown Data/)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500); // Trigger promise resolution
    });

    await waitFor(() => {
      expect(getByText(/Mock Markdown Data/)).toBeInTheDocument();
    });
  });

  it("should report the error if fetching release notes fails", async () => {
    vi.useFakeTimers();

    mockFetchReleaseNotes.mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error("Something bad happened"));
          }, 500);
        })
    );

    render(<Controller />);

    await waitFor(() => {
      expect(Logger.error).toHaveBeenCalledWith(
        "ReleaseNotesController: Unable to fetch release notes.",
        new Error("Something bad happened")
      );
    });
  });

  it("should not fetch release notes if they are already loaded (double render)", async () => {
    const { rerender } = render(<Controller />);

    await waitFor(() => {
      expect(mockFetchReleaseNotes).toHaveBeenCalledTimes(1);
    });

    rerender(<Controller />);

    expect(mockFetchReleaseNotes).toHaveBeenCalledTimes(1); // One initial fetch only
  });
});
