import { BrowserRouter } from "react-router-dom";
import { axe } from "vitest-axe";

import { render, fireEvent } from "../../test-utils";
import { FormatDate } from "../../utils";

import ReviewCommentsListDialog from "./index";

const events: HistoryBase<ApplicationStatus>[] = [
  {
    status: "Inquired",
    dateTime: "2023-05-28T16:40:00Z",
    userID: "user-1",
    reviewComment: "first comment",
  },
  {
    status: "Inquired",
    dateTime: "2023-05-15T16:40:00Z",
    userID: "user-2",
    reviewComment: "second comment",
  },
];

describe("ReviewCommentsListDialog Accessibility Tests", () => {
  it("has no base accessibility violations", async () => {
    const { container } = render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ReviewCommentsListDialog
          open
          preTitle="CRDC Submission Request"
          events={events}
          onClose={() => {}}
          onView={() => {}}
        />
      </BrowserRouter>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("ReviewCommentsListDialog Tests", () => {
  it("renders all review comment events with date and time columns", () => {
    const { getByTestId } = render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ReviewCommentsListDialog
          open
          preTitle="CRDC Submission Request"
          events={events}
          onClose={() => {}}
          onView={() => {}}
        />
      </BrowserRouter>
    );

    expect(getByTestId("review-comments-list-item-0-date")).toHaveTextContent("5/28/2023");
    expect(getByTestId("review-comments-list-item-0-time")).toHaveTextContent(
      FormatDate(events[0].dateTime, "h:mm A", "N/A")
    );
    expect(getByTestId("review-comments-list-item-1-date")).toHaveTextContent("5/15/2023");
    expect(getByTestId("review-comments-list-item-1-time")).toHaveTextContent(
      FormatDate(events[1].dateTime, "h:mm A", "N/A")
    );
  });

  it("calls onView with the selected event", () => {
    const onView = vi.fn();

    const { getByTestId } = render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ReviewCommentsListDialog
          open
          preTitle="CRDC Submission Request"
          events={events}
          onClose={() => {}}
          onView={onView}
        />
      </BrowserRouter>
    );

    fireEvent.click(getByTestId("review-comments-list-item-1-view"));

    expect(onView).toHaveBeenCalledWith(events[1]);
  });

  it("calls onClose when the Close button is clicked", () => {
    const onClose = vi.fn();

    const { getByTestId } = render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ReviewCommentsListDialog
          open
          preTitle="CRDC Submission Request"
          events={events}
          onClose={onClose}
          onView={() => {}}
        />
      </BrowserRouter>
    );

    fireEvent.click(getByTestId("comments-dialog-close"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
