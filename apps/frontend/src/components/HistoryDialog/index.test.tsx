import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { render, waitFor, within } from "../../test-utils";

import HistoryDialog, { IconType } from "./index";

type MockStatuses = "uploaded" | "downloaded" | "error";

const IconMap: IconType<MockStatuses> = {
  uploaded: "upload",
  downloaded: "download",
  error: "error",
};

const BaseProps: React.ComponentProps<typeof HistoryDialog> = {
  open: true,
  preTitle: "",
  title: "",
  history: [],
  iconMap: IconMap,
  getTextColor: () => "red",
  onClose: () => {},
};

describe("Accessibility", () => {
  it("should have no violations", async () => {
    const { container } = render(<HistoryDialog {...BaseProps} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    expect(() => render(<HistoryDialog {...BaseProps} />)).not.toThrow();
  });

  it("should close the dialog when the 'Close' button is clicked", () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<HistoryDialog {...BaseProps} onClose={onClose} />);

    userEvent.click(getByTestId("history-dialog-close"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should close the dialog when the backdrop is clicked", () => {
    const onClose = vi.fn();
    const { getAllByRole } = render(<HistoryDialog {...BaseProps} onClose={onClose} />);

    userEvent.click(getAllByRole("presentation")[1]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should render the correct title", () => {
    const title = "This is a Test Title";
    const { getByTestId } = render(<HistoryDialog {...BaseProps} title={title} />);

    expect(within(getByTestId("history-dialog")).getByText(title)).toBeInTheDocument();
  });

  it("should render the correct pre-title", () => {
    const preTitle = "This is a Test Pre-Title";
    const { getByTestId } = render(<HistoryDialog {...BaseProps} preTitle={preTitle} />);

    expect(within(getByTestId("history-dialog")).getByText(preTitle)).toBeInTheDocument();
  });

  it("should call getTextColor with the correct status", () => {
    const getTextColor = vi.fn();
    const history: HistoryBase<MockStatuses>[] = [
      { status: "uploaded", dateTime: new Date().toISOString(), userID: "test", reviewComment: "" },
    ];

    render(<HistoryDialog {...BaseProps} history={history} getTextColor={getTextColor} />);

    expect(getTextColor).toHaveBeenCalledWith("uploaded");
  });

  it("should not render the headers if showHeaders is false", () => {
    const { queryByTestId, getByTestId, rerender } = render(
      <HistoryDialog {...BaseProps} showHeaders={false} />
    );

    expect(queryByTestId("history-dialog-header-row")).not.toBeInTheDocument();

    rerender(<HistoryDialog {...BaseProps} showHeaders />);

    expect(getByTestId("history-dialog-header-row")).toBeInTheDocument();
  });

  it("should render a custom status wrapper if provided", async () => {
    const getStatusWrapper = vi
      .fn()
      .mockImplementation(() => ({ children }) => (
        <div data-testid="mock-wrapper-for-status">{children}</div>
      ));

    const history: HistoryBase<MockStatuses>[] = [
      { status: "uploaded", dateTime: new Date().toISOString(), userID: "test", reviewComment: "" },
    ];

    const { getByTestId } = render(
      <HistoryDialog {...BaseProps} history={history} getStatusWrapper={getStatusWrapper} />
    );

    expect(getStatusWrapper).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(getByTestId("mock-wrapper-for-status")).toBeInTheDocument();
    });
  });
});

describe("Implementation Requirements", () => {
  it("should sort the history by date in descending order", () => {
    const history: HistoryBase<MockStatuses>[] = [
      { status: "error", dateTime: "2022-05-19T04:12:00Z", userID: "test", reviewComment: "" }, // 1
      { status: "uploaded", dateTime: "2022-03-20T14:45:00Z", userID: "test", reviewComment: "" }, // 3
      { status: "downloaded", dateTime: "2022-04-25T11:56:00Z", userID: "test", reviewComment: "" }, // 2
    ];

    const { getByTestId } = render(<HistoryDialog {...BaseProps} history={history} />);

    expect(
      within(getByTestId("history-item-0")).getByTestId("history-item-0-status")
    ).toHaveTextContent(/error/i);

    expect(
      within(getByTestId("history-item-1")).getByTestId("history-item-1-status")
    ).toHaveTextContent(/downloaded/i);

    expect(
      within(getByTestId("history-item-2")).getByTestId("history-item-2-status")
    ).toHaveTextContent(/uploaded/i);
  });

  it("should render the parsed date for each history item", () => {
    const history: HistoryBase<MockStatuses>[] = [
      { status: "uploaded", dateTime: "2022-03-20T14:45:00Z", userID: "test", reviewComment: "" },
    ];

    const { getByTestId } = render(<HistoryDialog {...BaseProps} history={history} />);

    expect(
      within(getByTestId("history-item-0")).getByTestId("history-item-0-date")
    ).toHaveTextContent("3/20/2022");
  });

  it("should render corresponding icon for the first history item", () => {
    const history: HistoryBase<MockStatuses>[] = [
      { status: "uploaded", dateTime: "2022-03-20T14:45:00Z", userID: "test", reviewComment: "" },
      { status: "downloaded", dateTime: "2019-09-05T11:56:00Z", userID: "test", reviewComment: "" },
    ];

    const { getByTestId, queryByTestId } = render(
      <HistoryDialog {...BaseProps} history={history} />
    );

    expect(getByTestId("history-item-0-icon")).toBeInTheDocument();
    expect(getByTestId("history-item-0-icon")).toHaveAttribute("src", IconMap.uploaded);

    expect(queryByTestId("history-item-1-icon")).not.toBeInTheDocument();
  });

  it("should render the status for each history item in uppercase", () => {
    const history: HistoryBase<MockStatuses>[] = [
      { status: "uploaded", dateTime: "2024-09-05T14:45:00Z", userID: "test", reviewComment: "" },
    ];

    const { getByTestId } = render(<HistoryDialog {...BaseProps} history={history} />);

    expect(
      within(getByTestId("history-item-0")).getByTestId("history-item-0-status")
    ).toHaveTextContent(/UPLOADED/);
  });

  it("should have the unparsed date as a title attribute on the date element", () => {
    const history: HistoryBase<MockStatuses>[] = [
      { status: "uploaded", dateTime: "2024-09-05T14:45:00Z", userID: "test", reviewComment: "" },
    ];

    const { getByTestId } = render(<HistoryDialog {...BaseProps} history={history} />);

    expect(
      within(getByTestId("history-item-0")).getByTestId("history-item-0-date")
    ).toHaveAttribute("title", "2024-09-05T14:45:00Z");
  });

  it("should render the name for each history item if provided", () => {
    const history: HistoryBase<MockStatuses>[] = [
      {
        status: "uploaded",
        dateTime: "2024-09-25T14:45:00Z",
        userID: "test",
        userName: "Test User",
      },
      {
        status: "downloaded",
        dateTime: "2024-09-11T14:45:00Z",
        userID: "test",
        userName: "Another User",
      },
    ];

    const { getByTestId } = render(<HistoryDialog {...BaseProps} history={history} />);

    expect(
      within(getByTestId("history-item-0")).getByTestId("history-item-0-name")
    ).toHaveTextContent("Test User");

    expect(
      within(getByTestId("history-item-1")).getByTestId("history-item-1-name")
    ).toHaveTextContent("Another User");
  });

  it("should truncate the name if it exceeds 14 characters and render a tooltip", async () => {
    const history: HistoryBase<MockStatuses>[] = [
      {
        status: "uploaded",
        dateTime: "2024-09-25T14:45:00Z",
        userID: "test",
        userName: "This is 15 Char",
      },
    ];

    const { getByTestId, getByRole, getByText } = render(
      <HistoryDialog {...BaseProps} history={history} />
    );

    expect(
      within(getByTestId("history-item-0")).getByTestId("history-item-0-name")
    ).toHaveTextContent("This is 15 Cha...");

    userEvent.hover(getByText("This is 15 Cha..."));

    await waitFor(() => {
      expect(getByRole("tooltip")).toBeInTheDocument();
    });

    expect(getByText("This is 15 Char")).toBeInTheDocument();
  });

  // NOTE: This test will fail if the name is truncated as it would query for the wrong element
  it("should render all names but the first with a dimmed text color", () => {
    const history: HistoryBase<MockStatuses>[] = [
      {
        status: "uploaded",
        dateTime: "2024-09-25T14:45:00Z",
        userID: "test",
        userName: "Top Entry",
      },
      {
        status: "downloaded",
        dateTime: "2024-09-11T14:45:00Z",
        userID: "test",
        userName: "Second Entry",
      },
      {
        status: "error",
        dateTime: "2024-09-05T14:45:00Z",
        userID: "test",
        userName: "Third Entry",
      },
    ];

    const { getByTestId } = render(
      <HistoryDialog {...BaseProps} history={history} getTextColor={undefined} />
    );

    expect(within(getByTestId("history-item-0")).getByTestId("truncated-text-wrapper")).toHaveStyle(
      {
        color: "rgba(255, 255, 255, 1)",
      }
    );

    expect(within(getByTestId("history-item-1")).getByTestId("truncated-text-wrapper")).toHaveStyle(
      {
        color: "rgba(151, 181, 206, 1)",
      }
    );

    expect(within(getByTestId("history-item-2")).getByTestId("truncated-text-wrapper")).toHaveStyle(
      {
        color: "rgba(151, 181, 206, 1)",
      }
    );
  });

  it("should not render the name for each history item if not provided", () => {
    const history: HistoryBase<MockStatuses>[] = [
      { status: "uploaded", dateTime: "2024-09-25T14:45:00Z", userID: "test" },
      { status: "downloaded", dateTime: "2024-09-11T14:45:00Z", userID: "test" },
    ];

    const { queryByTestId } = render(<HistoryDialog {...BaseProps} history={history} />);

    expect(queryByTestId("history-item-0-name")).not.toBeInTheDocument();
    expect(queryByTestId("history-item-1-name")).not.toBeInTheDocument();
  });

  it("should fallback to #FFF if getTextColor is not a function", () => {
    const history: HistoryBase<MockStatuses>[] = [
      { status: "uploaded", dateTime: "2024-09-05T14:45:00Z", userID: "test", reviewComment: "" },
    ];

    const { getByTestId } = render(
      <HistoryDialog {...BaseProps} history={history} getTextColor={undefined} />
    );

    expect(within(getByTestId("history-item-0")).getByTestId("history-item-0-status")).toHaveStyle({
      color: "#FFF",
    });
  });
});
