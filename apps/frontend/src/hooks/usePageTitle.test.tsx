import { renderHook } from "../test-utils";

import usePageTitle from "./usePageTitle";

describe("Basic Functionality", () => {
  beforeEach(() => {
    document.title = "CRDC Submission Portal";
  });

  it("should set the document title on mount", () => {
    expect(document.title).toBe("CRDC Submission Portal");

    renderHook(() => usePageTitle("New Title"));

    expect(document.title).toBe("New Title");
  });

  it("should update the document title when the title prop changes", () => {
    const { rerender } = renderHook(({ title }) => usePageTitle(title), {
      initialProps: { title: "First Title" },
    });

    expect(document.title).toBe("First Title");

    rerender({ title: "Second Title" });

    expect(document.title).toBe("Second Title");
  });

  it("should restore the document title on unmount if restore is true", () => {
    const { unmount } = renderHook(() => usePageTitle("Test Title", true));
    expect(document.title).toBe("Test Title");

    unmount();
    expect(document.title).toBe("CRDC Submission Portal");
  });

  it("should restore the document title on unmount if restore is not provided", () => {
    const { unmount } = renderHook(() => usePageTitle("Page XYZ"));
    expect(document.title).toBe("Page XYZ");

    unmount();
    expect(document.title).toBe("CRDC Submission Portal");
  });

  it("should not restore the document title on unmount if restore is false", () => {
    const { unmount } = renderHook(() => usePageTitle("Test Title", false));
    expect(document.title).toBe("Test Title");

    unmount();
    expect(document.title).toBe("Test Title");
  });
});
