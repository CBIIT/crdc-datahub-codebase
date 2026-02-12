import { ThemeProvider, rgbToHex } from "@mui/material";
import { BrowserRouter } from "react-router-dom";
import { axe } from "vitest-axe";

import { render, fireEvent, waitFor } from "../../test-utils";
import theme from "../../theme";

import ReviewCommentsDialog from "./index";

type Props<T, H> = {
  open: boolean;
  status?: T;
  lastReview: HistoryBase<H>;
  title: string;
  onClose?: () => void;
};

const BaseComponent = <T, H>({ open, status, lastReview, title, onClose }: Props<T, H>) => (
  <ThemeProvider theme={theme}>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ReviewCommentsDialog
        open={open}
        onClose={onClose}
        lastReview={lastReview}
        status={status}
        preTitle={title}
      />
    </BrowserRouter>
  </ThemeProvider>
);

const mockLastReview: HistoryBase<unknown> = {
  dateTime: "2023-01-01T00:00:00Z",
  reviewComment: "This is a mock comment",
  status: undefined,
  userID: "",
};

describe("ReviewCommentsDialog Accessibility Tests", () => {
  it("has no base accessibility violations", async () => {
    const data = {
      open: true,
      title: "",
      lastReview: {
        status: undefined,
        reviewComment: "",
        dateTime: "",
        userID: "",
      },
    };

    const { container } = render(<BaseComponent {...data} />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("has no accessibility violations when there are review comments", async () => {
    const data = {
      open: true,
      title: "Title",
      lastReview: mockLastReview,
    };

    const { container } = render(<BaseComponent {...data} />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});

describe("ReviewCommentsDialog Tests", () => {
  it("renders the dialog with review comments correctly", () => {
    const data = {
      open: true,
      title: "",
      lastReview: mockLastReview,
      onClose: () => {},
    };

    const { getByText } = render(<BaseComponent {...data} />);

    expect(getByText(/Review Comments/)).toBeInTheDocument();
    expect(getByText(mockLastReview.reviewComment)).toBeInTheDocument();
  });

  it("provides the unformatted review date as a title attribute", () => {
    const data = {
      open: true,
      title: "",
      lastReview: mockLastReview,
      onClose: () => {},
    };
    const { getByText } = render(<BaseComponent {...data} />);

    expect(getByText(/Based on submission from/)).toHaveAttribute("title", mockLastReview.dateTime);
  });

  it("closes the dialog when the close button is clicked", async () => {
    const mockClose = vi.fn();
    const data = {
      open: true,
      title: "",
      lastReview: mockLastReview,
      onClose: mockClose,
    };

    const { getByTestId } = render(<BaseComponent {...data} />);

    fireEvent.click(getByTestId("review-comments-dialog-close"));

    await waitFor(() => expect(mockClose).toHaveBeenCalled());
  });

  it("does not render the dialog when open is false", () => {
    const data = {
      open: false,
      title: "",
      lastReview: mockLastReview,
      onClose: () => {},
    };

    const { queryByTestId, queryByText } = render(<BaseComponent {...data} />);

    expect(queryByTestId("review-comments-dialog")).not.toBeInTheDocument();
    expect(queryByText("Review Comments")).not.toBeInTheDocument();
  });

  it("renders the title passed through prop", () => {
    const customTitle = "Custom Dialog Title";
    const data = {
      open: true,
      title: customTitle,
      lastReview: mockLastReview,
      onClose: () => {},
    };

    const { getByText } = render(<BaseComponent {...data} />);
    expect(getByText(customTitle)).toBeInTheDocument();
  });

  it("renders the title with correct color", () => {
    const mockGetColorScheme = vi
      .fn()
      .mockImplementation((status) => (status === "Approved" ? "#0D6E87" : "#E25C22"));

    const data = {
      open: true,
      title: "",
      status: "Approved",
      lastReview: mockLastReview,
      onClose: () => {},
    };

    const { getByTestId } = render(<BaseComponent {...data} />);
    const styles = getComputedStyle(getByTestId("review-comments-dialog-title"));

    expect(rgbToHex(styles.color).toUpperCase()).toBe(
      mockGetColorScheme(data.status).toUpperCase()
    );
  });

  it("renders the dialog border with correct color", () => {
    const mockGetColorScheme = vi
      .fn()
      .mockImplementation((status) => (status === "Approved" ? "#0D6E87" : "#E25C22"));

    const data = {
      open: true,
      title: "",
      status: "Approved",
      lastReview: mockLastReview,
      onClose: () => {},
    };

    const { getByTestId } = render(<BaseComponent {...data} />);
    const styles = getComputedStyle(getByTestId("review-comments-dialog-paper"));

    expect(rgbToHex(styles.borderColor).toUpperCase()).toBe(
      mockGetColorScheme(data.status).toUpperCase()
    );
  });

  it("should use the custom title prop for the dialog title", () => {
    const customTitle = "Custom Title";
    const data = {
      open: true,
      title: customTitle,
      lastReview: mockLastReview,
      onClose: () => {},
    };

    const { getByText } = render(<BaseComponent {...data} />);

    expect(getByText(customTitle)).toBeInTheDocument();
  });
});
