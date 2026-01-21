import userEvent from "@testing-library/user-event";
import { FC, useMemo } from "react";
import { BrowserRouter } from "react-router-dom";
import { axe } from "vitest-axe";

import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { formContextStateFactory } from "@/factories/application/FormContextStateFactory";
import { historyEventFactory } from "@/factories/application/HistoryEventFactory";

import StatusApproved from "../../assets/history/submissionRequest/StatusApproved.svg?url";
import StatusRejected from "../../assets/history/submissionRequest/StatusRejected.svg?url";
import { fireEvent, render, waitFor, within } from "../../test-utils";
import { FormatDate } from "../../utils";
import { ContextState, Context as FormCtx, Status as FormStatus } from "../Contexts/FormContext";

import { HistoryIconMap } from "./components/SubmissionRequestIconMap";
import StatusBar from "./StatusBar";

type Props = {
  data: Partial<Application>;
};

const BaseComponent: FC<Props> = ({ data = {} }: Props) => {
  const value = useMemo<ContextState>(
    () =>
      formContextStateFactory.build({
        data: applicationFactory.build({ ...data }),
        status: FormStatus.LOADED,
      }),
    [data]
  );

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <FormCtx.Provider value={value}>
        <StatusBar />
      </FormCtx.Provider>
    </BrowserRouter>
  );
};

describe("StatusBar Accessibility Tests", () => {
  it("has no base accessibility violations", async () => {
    const { container } = render(<BaseComponent data={{}} />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("has no accessibility violations when there are no review comments", async () => {
    const data = applicationFactory.build({
      history: [
        historyEventFactory.build({
          reviewComment: "",
        }),
      ],
    });

    const { container } = render(<BaseComponent data={data} />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("has no accessibility violations when there are review comments", async () => {
    const data = applicationFactory.build({
      history: [
        historyEventFactory.build({
          reviewComment: "This is a review comment",
        }),
      ],
    });

    const { container } = render(<BaseComponent data={data} />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});

describe("StatusBar > General Tests", () => {
  it("renders the base elements", () => {
    const { getByTestId, getByText } = render(<BaseComponent data={{}} />);

    expect(getByText("Status:")).toBeVisible();
    expect(getByTestId("status-bar-status")).toBeInTheDocument();
    expect(getByText("Last updated:")).toBeVisible();
    expect(getByTestId("status-bar-last-updated")).toBeInTheDocument();
  });

  it("should not render the review comments button by default", () => {
    const { getByText } = render(<BaseComponent data={{}} />);

    expect(() => getByText("Review Comments")).toThrow();
    expect(() => getByText("Full History")).toThrow();
  });

  // NOTE: We aren't using the root level reviewComment attribute, only the history level ones
  // So we're testing AGAINST it's usage here
  it("does not render the comments button for the Application.reviewComment attribute", () => {
    const data = historyEventFactory.build({
      reviewComment: "This is a review comment",
    });

    const { getByText } = render(<BaseComponent data={data} />);

    expect(() => getByText("View Comments")).toThrow();
  });

  it("renders the comments button only if there are review comments", () => {
    const data = applicationFactory.build({
      history: [
        historyEventFactory.build({
          reviewComment: "This is a review comment",
        }),
      ],
    });

    const { getByText } = render(<BaseComponent data={data} />);
    const btn = getByText("View Comments");

    expect(btn).toBeVisible();
    expect(btn).toHaveAttribute("aria-label", "View Comments");
  });

  it("new applications should still display the correct last updated date", () => {
    const data = applicationFactory.build({
      status: "New",
      updatedAt: "2023-06-20T09:13:58Z",
    });

    const { getByTestId } = render(<BaseComponent data={data} />);

    expect(getByTestId("status-bar-last-updated")).toHaveTextContent(
      FormatDate(data.updatedAt, "M/D/YYYY", "N/A")
    );
  });

  const invalidDates = [
    "",
    " ",
    "0-0-0",
    "YYYY-06-20T09:13:58",
    "-06-12T09:13:58.000Z",
    "12023-06-20T09:13:58",
  ];
  it.each(invalidDates)("defaults the last updated date to N/A for invalid date %p", (date) => {
    const data = applicationFactory.build({
      status: "In Progress",
      updatedAt: date,
    });

    const { getByTestId } = render(<BaseComponent data={data} />);

    expect(getByTestId("status-bar-last-updated")).toHaveTextContent("N/A");
  });

  const validDates = [
    ["2019-11-23T14:26:01Z", "11/23/2019"],
    ["2027-04-24T19:01:09Z", "4/24/2027"],
    ["2031-01-07T19:01:09Z", "1/7/2031"],
  ];
  it.each(validDates)("formats the last updated date %p as %p", (input, output) => {
    const data = applicationFactory.build({
      status: "In Progress",
      updatedAt: input,
    });

    const { getByTestId } = render(<BaseComponent data={data} />);

    expect(getByTestId("status-bar-last-updated")).toHaveTextContent(output);
  });

  const statusWithIcon: [ApplicationStatus, string][] = [
    ["Rejected", StatusRejected],
    ["Approved", StatusApproved],
  ];
  it.each(statusWithIcon)(
    "renders the correct status bar SVG icon for status %p",
    (status, svg) => {
      const { getByTestId } = render(<BaseComponent data={{ status }} />);
      const icon = getByTestId("status-bar-icon");

      expect(icon).toBeVisible();
      expect(icon).toHaveAttribute("alt", `${status} icon`);
      expect(icon).toHaveAttribute("src", svg);
    }
  );

  const statusWithoutIcon: ApplicationStatus[] = ["In Progress", "Submitted", "In Review", "New"];
  it.each(statusWithoutIcon)("does not render an icon for status %p", (status) => {
    const { getByTestId } = render(<BaseComponent data={{ status }} />);

    expect(() => getByTestId("status-bar-icon")).toThrow();
  });
});

describe("StatusBar > Comments Modal Tests", () => {
  it("does not render the modal if there are no comments in the history", () => {
    const data = applicationFactory.build({
      history: [
        historyEventFactory.build({ reviewComment: "", dateTime: "2019-11-23T14:26:01Z" }),
        historyEventFactory.build({ reviewComment: "", dateTime: "2019-11-26T15:36:01Z" }),
        historyEventFactory.build({ reviewComment: "", dateTime: "2019-11-30T01:26:01Z" }),
      ],
    });

    const { getByText } = render(<BaseComponent data={data} />);

    expect(() => getByText("Review Comments")).toThrow();
  });

  it("renders the modal when there historical comments", async () => {
    const data = applicationFactory.build({
      history: [
        historyEventFactory.build({
          reviewComment: "abc 123",
        }),
      ],
    });

    const { getByTestId, getByText } = render(<BaseComponent data={data} />);

    fireEvent.click(getByText("View Comments"));

    expect(getByTestId("review-comments-dialog")).toBeVisible();
  });

  it("renders the most recent comment by date", async () => {
    const data = applicationFactory.build({
      history: [
        historyEventFactory.build({
          reviewComment: "not visible",
          dateTime: "2019-11-23T14:26:01Z",
        }),
        historyEventFactory.build({
          reviewComment: "not visible",
          dateTime: "2019-11-26T15:36:01Z",
        }),
        historyEventFactory.build({
          reviewComment: "this is the most recent comment",
          dateTime: "2019-11-30T11:26:01Z",
        }),
      ],
    });

    const { getByTestId, getByText } = render(<BaseComponent data={data} />);

    fireEvent.click(getByText("View Comments"));

    expect(getByTestId("review-comments-dialog")).toBeVisible();
    expect(getByText(/BASED ON SUBMISSION FROM 11\/30\/2019:/i)).toBeVisible();
    expect(getByText(data.history[2].reviewComment)).toBeVisible();
  });

  it("uses the most recent comment regardless of sorting", async () => {
    const data = applicationFactory.build({
      history: [
        historyEventFactory.build({
          reviewComment: "not visible",
          dateTime: "2023-11-30T01:25:45Z",
        }),
        historyEventFactory.build({
          reviewComment: "this is the most recent comment",
          dateTime: "2023-12-30T11:26:01Z",
        }),
        historyEventFactory.build({
          reviewComment: "not visible",
          dateTime: "2023-11-23T14:26:01Z",
        }),
        historyEventFactory.build({
          reviewComment: "not visible",
          dateTime: "2023-11-26T15:36:01Z",
        }),
      ],
    });

    const { getByTestId, getByText } = render(<BaseComponent data={data} />);

    fireEvent.click(getByText("View Comments"));

    expect(getByTestId("review-comments-dialog")).toBeVisible();
    expect(getByText(/BASED ON SUBMISSION FROM 12\/30\/2023:/i)).toBeVisible();
    expect(getByText(data.history[1].reviewComment)).toBeVisible();
  });

  it("uses the last event with a comment", async () => {
    const data = applicationFactory.build({
      history: [
        historyEventFactory.build({ reviewComment: "", dateTime: "2023-11-23T14:26:01Z" }),
        historyEventFactory.build({
          reviewComment: "not the latest, but has a comment",
          dateTime: "2023-11-26T15:36:01Z",
        }),
        historyEventFactory.build({ reviewComment: "", dateTime: "2023-11-30T01:25:45Z" }),
        historyEventFactory.build({ reviewComment: "", dateTime: "2023-12-30T01:26:01Z" }),
      ],
    });

    const { getByTestId, getByText } = render(<BaseComponent data={data} />);

    fireEvent.click(getByText("View Comments"));

    expect(getByTestId("review-comments-dialog")).toBeVisible();
    expect(getByText(/BASED ON SUBMISSION FROM 11\/26\/2023:/i)).toBeVisible();
    expect(getByText(data.history[1].reviewComment)).toBeVisible();
  });

  it("provides the unformatted review date as a title attribute", () => {
    const data = applicationFactory.build({
      history: [
        historyEventFactory.build({
          dateTime: "2009-11-24T11:42:45Z",
          reviewComment: "abc comment 123",
        }),
      ],
    });

    const { getByText } = render(<BaseComponent data={data} />);

    fireEvent.click(getByText("View Comments"));

    expect(getByText(/BASED ON SUBMISSION FROM 11\/24\/2009:/i)).toHaveAttribute(
      "title",
      data.history[0].dateTime
    );
  });

  it("closes the modal with the Close button", async () => {
    const data = applicationFactory.build({
      history: [historyEventFactory.build({ reviewComment: "comment" })],
    });

    const { queryByTestId, getByText } = render(<BaseComponent data={data} />);

    fireEvent.click(getByText("View Comments"));

    expect(queryByTestId("review-comments-dialog")).toBeVisible();

    fireEvent.click(queryByTestId("review-comments-dialog-close"));

    await waitFor(() => expect(queryByTestId("review-comments-dialog")).toBeNull());
  });
});

describe("StatusBar > History Modal Tests", () => {
  it("does not render the modal if there are no historical events", () => {
    const data = applicationFactory.build({
      history: [],
    });

    const { getByText } = render(<BaseComponent data={data} />);

    expect(() => getByText("Full History")).toThrow();
  });

  it("renders the modal if there are historical events", () => {
    const data = applicationFactory.build({
      history: [historyEventFactory.build({ dateTime: "2019-11-23T14:26:01Z", status: "New" })],
    });

    const { getByTestId, getByText } = render(<BaseComponent data={data} />);

    fireEvent.click(getByText("Full History"));

    expect(getByTestId("status-bar-history-dialog")).toBeVisible();
  });

  it("sorts the historical events by date in descending order", () => {
    const data = applicationFactory.build({
      history: [
        historyEventFactory.build({ dateTime: "2023-11-24T13:25:45Z", status: "Rejected" }),
        historyEventFactory.build({ dateTime: "2023-11-20T14:26:01Z", status: "New" }),
        historyEventFactory.build({ dateTime: "2023-11-22T15:36:01Z", status: "In Progress" }),
      ],
    });

    const { getByTestId, getByText } = render(<BaseComponent data={data} />);

    fireEvent.click(getByText("Full History"));

    expect(
      within(getByTestId("history-item-0")).getByTestId("history-item-0-status")
    ).toHaveTextContent(/Rejected/i);
    expect(
      within(getByTestId("history-item-0")).getByTestId("history-item-0-date")
    ).toHaveTextContent("11/24/2023");

    expect(
      within(getByTestId("history-item-1")).getByTestId("history-item-1-status")
    ).toHaveTextContent(/In Progress/i);
    expect(
      within(getByTestId("history-item-1")).getByTestId("history-item-1-date")
    ).toHaveTextContent("11/22/2023");

    expect(
      within(getByTestId("history-item-2")).getByTestId("history-item-2-status")
    ).toHaveTextContent(/New/i);
    expect(
      within(getByTestId("history-item-2")).getByTestId("history-item-2-date")
    ).toHaveTextContent("11/20/2023");
  });

  it("renders only the most recent event with an icon", () => {
    const data = applicationFactory.build({
      history: [
        historyEventFactory.build({ dateTime: "2023-11-24T01:25:45Z", status: "Rejected" }),
        historyEventFactory.build({
          dateTime: "2023-11-22T15:36:01Z",
          status: "Completed" as ApplicationStatus,
        }),
      ],
    });

    const { getByTestId, getByText } = render(<BaseComponent data={data} />);

    fireEvent.click(getByText("Full History"));

    expect(getByTestId("history-item-0-icon")).toBeVisible();
    expect(() => getByTestId("history-item-1-icon")).toThrow();
  });

  it.each(Object.entries(HistoryIconMap))(
    "renders the correct icon for the status %s",
    (status: ApplicationStatus, svg) => {
      const data = applicationFactory.build({
        history: [historyEventFactory.build({ dateTime: "2023-11-24T01:25:45Z", status })],
      });

      const { getByTestId, getByText } = render(<BaseComponent data={data} />);

      fireEvent.click(getByText("Full History"));

      const icon = getByTestId("history-item-0-icon");

      expect(icon).toBeVisible();
      expect(icon).toHaveAttribute("alt", `${status} icon`);
      expect(icon).toHaveAttribute("src", svg);
    }
  );

  it("provides the unformatted event date as a title attribute", () => {
    const data = applicationFactory.build({
      history: [
        historyEventFactory.build({ dateTime: "2009-11-24T01:25:45Z", status: "Rejected" }),
      ],
    });

    const { getByText } = render(<BaseComponent data={data} />);

    fireEvent.click(getByText("Full History"));

    expect(getByText("11/24/2009")).toHaveAttribute("title", data.history[0].dateTime);
  });

  it("closes the modal with the Close button", async () => {
    const data = applicationFactory.build({
      history: [
        historyEventFactory.build({ dateTime: "2009-11-24T01:25:45Z", status: "Rejected" }),
      ],
    });

    const { queryByTestId, getByText } = render(<BaseComponent data={data} />);

    fireEvent.click(getByText("Full History"));

    expect(queryByTestId("status-bar-history-dialog")).toBeVisible();

    fireEvent.click(queryByTestId("history-dialog-close"));

    await waitFor(() => expect(queryByTestId("status-bar-history-dialog")).toBeNull());
  });

  it("should render a icon when there are pending conditions and the status is 'Approved'", async () => {
    const data = applicationFactory.build({
      history: [
        historyEventFactory.build({ dateTime: "2009-11-24T01:25:45Z", status: "Approved" }),
        historyEventFactory.build({ dateTime: "2009-11-24T01:10:45Z", status: "In Progress" }),
      ],
      pendingConditions: ["condition xyz please resolve it"],
      conditional: true,
    });

    const { getByTestId, getByText, getByRole } = render(<BaseComponent data={data} />);

    userEvent.click(getByText("Full History"));

    const approvedItem = getByTestId("history-item-0");
    expect(within(approvedItem).getByTestId("history-item-0-status")).toHaveTextContent(
      /Approved/i
    ); // sanity check
    expect(within(approvedItem).getByTestId("status-bar-pending-conditions")).toBeVisible();

    userEvent.hover(within(approvedItem).getByTestId("status-bar-pending-conditions"));

    await waitFor(() => {
      expect(getByRole("tooltip")).toBeVisible();
    });

    expect(getByRole("tooltip")).toHaveTextContent(data.pendingConditions[0]);

    const inProgressItem = getByTestId("history-item-1");
    expect(within(inProgressItem).getByTestId("history-item-1-status")).toHaveTextContent(
      /In Progress/i
    );
    expect(() => within(inProgressItem).getByTestId("status-bar-pending-conditions")).toThrow();
  });

  it.each<[ApplicationStatus, string]>([
    ["New", "The request form was created."],
    ["In Progress", "The request form was started but not submitted."],
    ["Submitted", "The request form was submitted for review."],
    ["In Review", "The request form is under evaluation by the Submission Review Committee."],
    ["Approved", "The request form was reviewed and approved."],
    ["Rejected", "The request form was reviewed and rejected."],
    ["Inquired", "Additional information or clarification was requested from the submitter."],
    // TODO: Uncomment when the statuses are added to the application
    // ["Canceled", "The request form was manually canceled and is no longer active."],
    // [
    //   "Deleted",
    //   "The request form was automatically deleted by the system due to inactivity and is no longer active.",
    // ],
  ])(
    "should provide a tooltip on the history item for the status '%s'",
    async (status, tooltip) => {
      const data = applicationFactory.build({
        history: [historyEventFactory.build({ dateTime: "2009-11-24T01:25:45Z", status })],
      });

      const { getByText, getByTestId, getByRole } = render(<BaseComponent data={data} />);

      userEvent.click(getByText("Full History"));

      userEvent.hover(within(getByTestId("history-item-0")).getByText(new RegExp(status, "i")));

      await waitFor(() => {
        expect(getByRole("tooltip")).toBeVisible();
      });

      expect(getByRole("tooltip")).toHaveTextContent(tooltip);
    }
  );
});
