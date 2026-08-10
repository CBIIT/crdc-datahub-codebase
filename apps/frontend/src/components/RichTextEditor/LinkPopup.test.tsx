import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { render } from "../../test-utils";

import type { LinkPopupController } from "./hooks/useLinkPopup";
import LinkPopup from "./LinkPopup";

const createMockPopup = (
  overrides: Partial<LinkPopupController["state"]> = {}
): LinkPopupController => ({
  state: {
    open: true,
    mode: "edit",
    anchorElement: document.createElement("div"),
    text: "",
    url: "",
    error: "",
    linkPath: null,
    ...overrides,
  },
  openFromToolbar: vi.fn(),
  openFromLink: vi.fn(),
  startEditing: vi.fn(),
  setText: vi.fn(),
  setUrl: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  close: vi.fn(),
  resetAfterClose: vi.fn(),
});

describe("Accessibility", () => {
  it("should have no violations in edit mode", async () => {
    const { container } = render(<LinkPopup popup={createMockPopup()} />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations in view mode", async () => {
    const popup = createMockPopup({
      mode: "view",
      text: "Google",
      url: "https://google.com",
      linkPath: [0, 0],
    });

    const { container } = render(<LinkPopup popup={popup} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render the popup when open", () => {
    const { getByTestId } = render(<LinkPopup popup={createMockPopup()} />);

    expect(getByTestId("rich-text-link-popup")).toBeInTheDocument();
  });

  it("should render the text and link inputs in edit mode", () => {
    const { getByTestId } = render(<LinkPopup popup={createMockPopup()} />);

    expect(getByTestId("rich-text-link-popup-text-input")).toBeInTheDocument();
    expect(getByTestId("rich-text-link-popup-url-input")).toBeInTheDocument();
  });

  it("should render the close button", () => {
    const { getByTestId } = render(<LinkPopup popup={createMockPopup()} />);

    expect(getByTestId("rich-text-link-popup-close")).toBeInTheDocument();
  });

  it("should render the link URL in view mode", () => {
    const popup = createMockPopup({
      mode: "view",
      text: "Google",
      url: "https://google.com",
      linkPath: [0, 0],
    });

    const { getByTestId } = render(<LinkPopup popup={popup} />);

    expect(getByTestId("rich-text-link-popup-url")).toHaveTextContent("https://google.com");
  });

  it("should show 'Add link' title when adding a new link", () => {
    const { getByText } = render(<LinkPopup popup={createMockPopup()} />);

    expect(getByText("Add link")).toBeInTheDocument();
  });

  it("should show 'Edit link' title when editing an existing link", () => {
    const popup = createMockPopup({ mode: "edit", linkPath: [0, 0] });

    const { getByText } = render(<LinkPopup popup={popup} />);

    expect(getByText("Edit link")).toBeInTheDocument();
  });
});

describe("Implementation Requirements", () => {
  it("should call close when the close button is clicked", async () => {
    const popup = createMockPopup();

    const { getByTestId } = render(<LinkPopup popup={popup} />);

    userEvent.click(getByTestId("rich-text-link-popup-close"));

    expect(popup.close).toHaveBeenCalledTimes(1);
  });

  it("should call setText when the text input changes", async () => {
    const popup = createMockPopup();

    const { getByTestId } = render(<LinkPopup popup={popup} />);

    userEvent.type(getByTestId("rich-text-link-popup-text-input"), "Hello");

    expect(popup.setText).toHaveBeenCalled();
  });

  it("should call setUrl when the URL input changes", async () => {
    const popup = createMockPopup();

    const { getByTestId } = render(<LinkPopup popup={popup} />);

    userEvent.type(getByTestId("rich-text-link-popup-url-input"), "google.com");

    expect(popup.setUrl).toHaveBeenCalled();
  });

  it("should call save when the save button is clicked", async () => {
    const popup = createMockPopup();

    const { getByTestId } = render(<LinkPopup popup={popup} />);

    userEvent.click(getByTestId("rich-text-link-popup-save"));

    expect(popup.save).toHaveBeenCalledTimes(1);
  });

  it("should call save when Enter is pressed in the URL input", async () => {
    const popup = createMockPopup();

    const { getByTestId } = render(<LinkPopup popup={popup} />);

    userEvent.type(getByTestId("rich-text-link-popup-url-input"), "{Enter}");

    expect(popup.save).toHaveBeenCalledTimes(1);
  });

  it("should call close when the cancel button is clicked", async () => {
    const popup = createMockPopup();

    const { getByTestId } = render(<LinkPopup popup={popup} />);

    userEvent.click(getByTestId("rich-text-link-popup-cancel"));

    expect(popup.close).toHaveBeenCalledTimes(1);
  });

  it("should call remove when the remove button is clicked in view mode", async () => {
    const popup = createMockPopup({
      mode: "view",
      text: "Google",
      url: "https://google.com",
      linkPath: [0, 0],
    });

    const { getByTestId } = render(<LinkPopup popup={popup} />);

    userEvent.click(getByTestId("rich-text-link-popup-remove"));

    expect(popup.remove).toHaveBeenCalledTimes(1);
  });

  it("should call startEditing when the edit button is clicked in view mode", async () => {
    const popup = createMockPopup({
      mode: "view",
      text: "Google",
      url: "https://google.com",
      linkPath: [0, 0],
    });

    const { getByTestId } = render(<LinkPopup popup={popup} />);

    userEvent.click(getByTestId("rich-text-link-popup-edit"));

    expect(popup.startEditing).toHaveBeenCalledTimes(1);
  });

  it("should display the validation error when error is set", () => {
    const popup = createMockPopup({ error: "Please enter a valid URL." });

    const { getByText } = render(<LinkPopup popup={popup} />);

    expect(getByText("Please enter a valid URL")).toBeInTheDocument();
  });

  it("should not display an error message when error is empty", () => {
    const popup = createMockPopup({ error: "" });

    const { queryByText } = render(<LinkPopup popup={popup} />);

    expect(queryByText("Please enter a valid URL")).not.toBeInTheDocument();
  });

  it("should open the link URL in a new tab in view mode", () => {
    const popup = createMockPopup({
      mode: "view",
      text: "Google",
      url: "https://google.com",
      linkPath: [0, 0],
    });

    const { getByTestId } = render(<LinkPopup popup={popup} />);
    const link = getByTestId("rich-text-link-popup-url");

    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
