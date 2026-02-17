import { axe } from "vitest-axe";

import { fireEvent, render, waitFor } from "../../test-utils";

import ScrollButton from "./ScrollButtonView";

describe("Accessibility", () => {
  it("should not have accessibility violations", async () => {
    const { container } = render(<ScrollButton />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should be hidden by default", () => {
    const { getByTestId } = render(<ScrollButton />);

    expect(getByTestId("scroll-top-button")).toBeInTheDocument();
    expect(getByTestId("scroll-top-button")).not.toBeVisible();
  });

  it("should only appear when the user scrolls down", async () => {
    const { getByTestId } = render(<ScrollButton />);

    // TOP
    expect(getByTestId("scroll-top-button")).not.toBeVisible();
    expect(getByTestId("scroll-top-button")).toBeInTheDocument();

    // SCROLL DOWN
    fireEvent.scroll(window, { target: { scrollY: 300 } });
    await waitFor(() => expect(getByTestId("scroll-top-button")).toBeVisible());

    // SCROLL UP
    fireEvent.scroll(window, { target: { scrollY: 0 } });
    await waitFor(() => expect(getByTestId("scroll-top-button")).not.toBeVisible());
  });

  it("should scroll to the top of the page when clicked", () => {
    window.scrollTo = vi.fn();

    const { getByTestId } = render(<ScrollButton />);

    fireEvent.scroll(window, { target: { scrollY: 300 } });
    fireEvent.click(getByTestId("scroll-top-button"));

    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
