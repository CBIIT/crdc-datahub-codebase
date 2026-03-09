import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { isEqual } from "lodash";
import React, { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { organizationFactory } from "@/factories/auth/OrganizationFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { collaboratorFactory } from "@/factories/submission/CollaboratorFactory";
import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import { submissionHistoryEventFactory } from "@/factories/submission/SubmissionHistoryEvent";
import { EDIT_SUBMISSION } from "@/graphql";

import { TestRouter, render, waitFor } from "../../test-utils";
import { Context as AuthContext, ContextState as AuthContextState } from "../Contexts/AuthContext";
import {
  SubmissionContext,
  SubmissionCtxState,
  SubmissionCtxStatus,
} from "../Contexts/SubmissionContext";

import HistoryIconMap from "./DataSubmissionIconMap";
import DataSubmissionSummary from "./DataSubmissionSummary";

const baseSubmissionCtx: SubmissionCtxState = submissionCtxStateFactory.build({
  status: SubmissionCtxStatus.LOADING,
  data: null,
  error: null,
  startPolling: vi.fn(),
  stopPolling: vi.fn(),
  refetch: vi.fn(),
  updateQuery: vi.fn(),
});

type SummaryProps = {
  dataSubmission: Submission;
};

type Props = {
  children: React.ReactNode;
  mocks?: MockedResponse[];
  role?: UserRole;
  submissionCtxState?: SubmissionCtxState;
  user?: User;
};

const BaseComponent: FC<Props> = ({
  role = "Submitter",
  submissionCtxState = baseSubmissionCtx,
  mocks = [],
  user,
  children,
}) => {
  const authState = useMemo<AuthContextState>(
    () =>
      authCtxStateFactory.build({
        isLoggedIn: true,
        user: user ?? userFactory.build({ role, permissions: ["data_submission:view"] }),
      }),
    [role, user]
  );

  return (
    <MockedProvider mocks={mocks}>
      <AuthContext.Provider value={authState}>
        <SubmissionContext.Provider value={submissionCtxState}>
          <TestRouter basename="">{children}</TestRouter>
        </SubmissionContext.Provider>
      </AuthContext.Provider>
    </MockedProvider>
  );
};

describe("DataSubmissionSummary Accessibility Tests", () => {
  it("has no accessibility violations when there are review comments", async () => {
    const dataSubmission: RecursivePartial<Submission> = {
      history: [
        submissionHistoryEventFactory.build({
          reviewComment: "This is a review comment",
          status: "New",
          dateTime: "",
          userID: "",
        }),
      ],
    };

    const { container } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("renders all property labels and corresponding values", () => {
    const dataSubmission: RecursivePartial<Submission> = {
      name: "Test Submission AAAAAA",
      intention: "Test Intention AAAAAA" as SubmissionIntention,
      submitterName: "Submitter Test AAAAAA",
      collaborators: collaboratorFactory.build(2, (index) => ({
        collaboratorID: `col-${index + 1}`,
        collaboratorName: `Collaborator ${index + 1}`,
        permission: "Can Edit",
      })),
      studyAbbreviation: "AAAAAAAAAAAAAAAAAAAAAAAAAA",
      dataCommons: "Test Commons AAAAAA",
      dataCommonsDisplayName: "A Display Name of TC AAAAAA",
      organization: organizationFactory.pick(["_id", "name", "abbreviation"]).build({
        _id: "",
        name: "Test Program AAAAAA",
        abbreviation: "Test Program Abbreviation",
      }),
      conciergeName: "Test Concierge AAAAAA",
      conciergeEmail: "concierge@test.com",
    };

    const { getByText, getByLabelText } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    // Check labels
    expect(getByText("Submission Name")).toBeVisible();
    expect(getByText("Submission Type")).toBeVisible();
    expect(getByText("Submitter")).toBeVisible();
    expect(getByText("Collaborators")).toBeVisible();
    expect(getByText("Study")).toBeVisible();
    expect(getByText("Data Commons")).toBeVisible();
    expect(getByText("Program")).toBeVisible();
    expect(getByText("Data Concierge")).toBeVisible();

    // Check values
    expect(getByText("Test Submission...")).toBeVisible();
    expect(getByText("Test Intention AAAAAA")).toBeVisible(); // Not truncated
    expect(getByText("Submitter Test A...")).toBeVisible();
    expect(getByText("AAAAAAAAAAAAAAAAAAAAAAAAA...")).toBeVisible();
    expect(getByText("A Display Name of TC AAAAAA")).toBeVisible(); // Not truncated
    expect(getByText("Test Program Abbreviati...")).toBeVisible();
    expect(getByText("Test Concierge A...")).toBeVisible();

    expect(getByText("2")).toBeVisible();

    const emailLink = getByLabelText("Email Data Concierge");
    expect(emailLink).toBeVisible();
    expect(emailLink).toHaveAttribute("href", "mailto:concierge@test.com");
  });

  it("renders the Collaborators property with correct number and tooltip", async () => {
    const dataSubmission: RecursivePartial<Submission> = {
      collaborators: collaboratorFactory.build(3, (index) => ({
        collaboratorID: `${index + 1}`,
        collaboratorName: `Collaborator ${index + 1}`,
        permission: "Can Edit",
      })),
    };

    const { getByTestId } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    // Hover to trigger the tooltip
    userEvent.hover(getByTestId("collaborators-button"));

    await waitFor(() => {
      expect(getByTestId("collaborators-button-tooltip")).toBeVisible();
      expect(getByTestId("collaborators-button-tooltip")).toHaveTextContent(
        "Click to add new collaborators or view existing ones."
      );
    });
  });

  it("renders the Data Concierge with name and email link when email is provided", () => {
    const dataSubmission: RecursivePartial<Submission> = {
      conciergeName: "Test Concierge",
      conciergeEmail: "concierge@test.com",
    };

    const { getByText, getByLabelText } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    expect(getByText("Data Concierge")).toBeVisible();
    expect(getByText("Test Concierge")).toBeVisible();

    const emailLink = getByLabelText("Email Data Concierge");
    expect(emailLink).toBeVisible();
    expect(emailLink).toHaveAttribute("href", "mailto:concierge@test.com");
  });

  it("renders the Data Concierge with name only when email is not provided", () => {
    const dataSubmission: RecursivePartial<Submission> = {
      conciergeName: "Test Concierge",
      conciergeEmail: null,
    };

    const { getByText, queryByLabelText } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    expect(getByText("Data Concierge")).toBeVisible();
    expect(getByText("Test Concierge")).toBeVisible();

    const emailLink = queryByLabelText("Email Data Concierge");
    expect(emailLink).toBeNull();
  });

  it("renders the Program as NA when no program abbreviation is assigned", () => {
    const dataSubmission: RecursivePartial<Submission> = {
      organization: null,
      studyAbbreviation: "some-study",
    };

    const { getByText } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    expect(getByText("Program")).toBeVisible();
    expect(getByText("NA")).toBeVisible();
  });

  it("renders the Study as NA when no study abbreviation is assigned", () => {
    const dataSubmission: RecursivePartial<Submission> = {
      organization: organizationFactory.pick(["_id", "name", "abbreviation"]).build({
        _id: "org-1",
        abbreviation: "some-org",
      }),
      studyAbbreviation: null,
    };

    const { getByText } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    expect(getByText("Study")).toBeVisible();
    expect(getByText("NA")).toBeVisible();
  });
});

describe("DataSubmissionSummary Memoization Tests", () => {
  it("does not re-render when props are equal due to memoization", () => {
    const dataSubmission: RecursivePartial<Submission> = {
      name: "Test Submission",
    };

    const renderSpy = vi.fn();

    const MemoizedComponent = ({ dataSubmission }: SummaryProps) => {
      React.useEffect(() => {
        renderSpy();
      });
      return <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />;
    };

    const MemoizedComponentWithMemo = React.memo(MemoizedComponent, (prevProps, nextProps) =>
      isEqual(prevProps, nextProps)
    );

    const { rerender } = render(
      <BaseComponent>
        <MemoizedComponentWithMemo dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    expect(renderSpy).toHaveBeenCalledTimes(1);

    rerender(
      <BaseComponent>
        <MemoizedComponentWithMemo dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    // renderSpy should not have been called again
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it("re-renders when props change due to memoization", () => {
    const dataSubmission: RecursivePartial<Submission> = {
      name: "Test Submission",
    };

    const newDataSubmission: RecursivePartial<Submission> = {
      name: "Updated Submission",
    };

    const renderSpy = vi.fn();

    const MemoizedComponent = ({ dataSubmission }: SummaryProps) => {
      React.useEffect(() => {
        renderSpy();
      });
      return <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />;
    };

    const MemoizedComponentWithMemo = React.memo(MemoizedComponent, (prevProps, nextProps) =>
      isEqual(prevProps, nextProps)
    );

    const { rerender } = render(
      <BaseComponent>
        <MemoizedComponentWithMemo dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    expect(renderSpy).toHaveBeenCalledTimes(1);

    // Re-render with different props
    rerender(
      <BaseComponent>
        <MemoizedComponentWithMemo dataSubmission={newDataSubmission as Submission} />
      </BaseComponent>
    );

    // renderSpy should have been called again
    expect(renderSpy).toHaveBeenCalledTimes(2);
  });
});

describe("DataSubmissionSummary Review Comments Dialog Tests", () => {
  it("renders the Review Comments button if there is a review comment", () => {
    const dataSubmission: RecursivePartial<Submission> = {
      history: [
        submissionHistoryEventFactory.build({
          reviewComment: "This is a review comment",
          status: "New",
          dateTime: "",
          userID: "",
        }),
      ],
    };

    const { getByText } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );
    expect(getByText("Review Comments")).toBeVisible();
  });

  it("shows the correct content in the Review Comments dialog", async () => {
    const dataSubmission: RecursivePartial<Submission> = {
      history: [
        submissionHistoryEventFactory.build({
          status: "Rejected",
          reviewComment: "This is the most recent review comment",
          dateTime: "2023-11-30T11:26:01Z",
          userID: "",
        }),
      ],
    };

    const { getByText } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    userEvent.click(getByText("Review Comments"));

    await waitFor(() => {
      expect(getByText(/This is the most recent review comment/)).toBeVisible();
    });
  });

  it("only shows the review comment for the latest 'Rejected' submission, ignoring other statuses", async () => {
    const dataSubmission: RecursivePartial<Submission> = {
      history: [
        submissionHistoryEventFactory.build({
          status: "Rejected",
          reviewComment: "This is a rejected comment",
          dateTime: "2023-11-29T11:26:01Z",
          userID: "",
        }),
        submissionHistoryEventFactory.build({
          status: "Submitted",
          reviewComment: "Admin Submit - This should not be displayed",
          dateTime: "2023-11-30T11:26:01Z",
          userID: "",
        }),
      ],
    };

    const { getByText } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    userEvent.click(getByText("Review Comments"));

    await waitFor(() => {
      expect(getByText(/This is a rejected comment/)).toBeVisible();
      expect(() => getByText(/This should not be displayed/)).toThrow();
    });
  });

  it("closes the Review Comments dialog with the close button", async () => {
    const dataSubmission: RecursivePartial<Submission> = {
      history: [
        submissionHistoryEventFactory.build({
          status: "Rejected",
          reviewComment: "Comment for closing test",
          dateTime: "2023-11-30T11:26:01Z",
          userID: "",
        }),
      ],
    };

    const { getByText, getByTestId, queryByText } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    userEvent.click(getByText("Review Comments"));

    await waitFor(() => expect(getByText("Comment for closing test")).toBeVisible());

    userEvent.click(getByTestId("review-comments-dialog-close"));

    await waitFor(() => expect(queryByText("Comment for closing test")).not.toBeInTheDocument());
  });

  it("closes the Review Comments dialog with the close icon button", async () => {
    const dataSubmission: RecursivePartial<Submission> = {
      history: [
        submissionHistoryEventFactory.build({
          status: "Rejected",
          reviewComment: "Another comment for close icon test",
          dateTime: "2023-11-30T11:26:01Z",
          userID: "",
        }),
      ],
    };

    const { getByText, queryByText, getByTestId } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    userEvent.click(getByText("Review Comments"));

    await waitFor(() => expect(getByText("Another comment for close icon test")).toBeVisible());

    const closeButton = getByTestId("review-comments-dialog-close-icon-button");
    userEvent.click(closeButton);

    await waitFor(() =>
      expect(queryByText("Another comment for close icon test")).not.toBeInTheDocument()
    );
  });
});

describe("DataSubmissionSummary History Dialog Tests", () => {
  it("renders the Full History button if there are historical events", () => {
    const dataSubmission: RecursivePartial<Submission> = {
      history: [
        submissionHistoryEventFactory.build({
          dateTime: "2023-11-23T14:26:01Z",
          status: "New",
          userID: "",
        }),
      ],
    };

    const { getByText } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );
    expect(getByText("Full History")).toBeVisible();
  });

  it("renders the history events correctly in the dialog", async () => {
    const dataSubmission: RecursivePartial<Submission> = {
      history: [
        submissionHistoryEventFactory.build({
          dateTime: "2023-11-30T11:26:01Z",
          status: "Submitted",
        }),
        submissionHistoryEventFactory.build({
          dateTime: "2023-11-25T10:00:00Z",
          status: "In Progress",
        }),
      ],
    };

    const { getByText } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    userEvent.click(getByText("Full History"));

    await waitFor(() => {
      expect(getByText("SUBMITTED")).toBeVisible();
      expect(getByText("IN PROGRESS")).toBeVisible();
    });
  });

  it("renders the modal and displays history events in descending order", async () => {
    const dataSubmission: RecursivePartial<Submission> = {
      history: [
        submissionHistoryEventFactory.build({
          dateTime: "2023-01-02T10:00:00Z",
          status: "In Progress",
        }),
        submissionHistoryEventFactory.build({
          dateTime: "2023-01-01T10:00:00Z",
          status: "New",
        }),
        submissionHistoryEventFactory.build({
          dateTime: "2023-01-03T10:00:00Z",
          status: "Submitted",
        }),
        submissionHistoryEventFactory.build({
          dateTime: "2023-01-04T10:00:00Z",
          status: "Rejected",
        }),
        submissionHistoryEventFactory.build({
          dateTime: "2023-01-05T10:00:00Z",
          status: "In Progress",
        }),
        submissionHistoryEventFactory.build({
          dateTime: "2023-01-06T10:00:00Z",
          status: "Submitted",
        }),
        submissionHistoryEventFactory.build({
          dateTime: "2023-01-07T10:00:00Z",
          status: "Released",
        }),
        submissionHistoryEventFactory.build({
          dateTime: "2023-01-08T10:00:00Z",
          status: "Completed",
        }),
      ],
    };

    const { getAllByTestId, getByText } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    userEvent.click(getByText("Full History"));

    const dates = getAllByTestId(/history-item-\d-date/i);
    const statuses = getAllByTestId(/history-item-\d-status/i);
    expect(statuses[0]).toHaveTextContent(/COMPLETED/i);
    expect(dates[0]).toHaveTextContent("1/8/2023");
    expect(statuses[1]).toHaveTextContent(/RELEASED/i);
    expect(dates[1]).toHaveTextContent("1/7/2023");
    expect(statuses[7]).toHaveTextContent(/NEW/i);
    expect(dates[7]).toHaveTextContent("1/1/2023");
  });

  it("closes the History dialog with the close button", async () => {
    const dataSubmission: RecursivePartial<Submission> = {
      history: [
        submissionHistoryEventFactory.build({
          dateTime: "2023-11-30T11:26:01Z",
          status: "Submitted",
        }),
      ],
    };

    const { getByText, queryByTestId } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    userEvent.click(getByText("Full History"));

    await waitFor(() => expect(queryByTestId("history-dialog")).toBeVisible());

    userEvent.click(queryByTestId("history-dialog-close"));

    await waitFor(() => expect(queryByTestId("history-dialog")).not.toBeInTheDocument());
  });

  it("sorts the historical events by date in descending order", async () => {
    const dataSubmission: RecursivePartial<Submission> = {
      history: [
        submissionHistoryEventFactory.build({
          dateTime: "2023-11-20T10:00:00Z",
          status: "New",
        }),
        submissionHistoryEventFactory.build({
          dateTime: "2023-11-22T10:00:00Z",
          status: "In Progress",
        }),
        submissionHistoryEventFactory.build({
          dateTime: "2023-11-24T10:00:00Z",
          status: "Submitted",
        }),
      ],
    };

    const { getByText, getAllByTestId } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    userEvent.click(getByText("Full History"));

    await waitFor(() => {
      const items = getAllByTestId(/history-item-\d-date/);
      expect(new Date(items[0].textContent).getTime()).toBeGreaterThan(
        new Date(items[1].textContent).getTime()
      );
      expect(new Date(items[1].textContent).getTime()).toBeGreaterThan(
        new Date(items[2].textContent).getTime()
      );
    });
  });

  it("renders only the most recent event with an icon", () => {
    const dataSubmission: RecursivePartial<Submission> = {
      history: [
        submissionHistoryEventFactory.build({
          dateTime: "2023-11-24T01:25:45Z",
          status: "Rejected",
        }),
        submissionHistoryEventFactory.build({
          dateTime: "2023-11-22T15:36:01Z",
          status: "Completed",
        }),
      ],
    };

    const { getByTestId, getByText } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    userEvent.click(getByText("Full History"));

    expect(getByTestId("history-item-0-icon")).toBeVisible();
    expect(() => getByTestId("history-item-1-icon")).toThrow();
  });

  it.each(Object.entries(HistoryIconMap))(
    "renders the correct icon for the status %s",
    (status, svg) => {
      const dataSubmission: RecursivePartial<Submission> = {
        history: [
          submissionHistoryEventFactory.build({
            dateTime: "2023-11-24T01:25:45Z",
            status: status as SubmissionStatus,
          }),
        ],
      };

      const { getByTestId, getByText } = render(
        <BaseComponent>
          <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
        </BaseComponent>
      );

      userEvent.click(getByText("Full History"));

      const icon = getByTestId("history-item-0-icon");

      expect(icon).toBeVisible();
      expect(icon).toHaveAttribute("alt", `${status} icon`);
      expect(icon).toHaveAttribute("src", svg);
    }
  );
});

describe("DataSubmissionSummary Collaborators Dialog Tests", () => {
  it("closes the Collaborators dialog with the close button", async () => {
    const dataSubmission: RecursivePartial<Submission> = {
      history: [
        submissionHistoryEventFactory.build({
          dateTime: "2023-11-30T11:26:01Z",
          status: "Submitted",
        }),
      ],
    };

    const { getByTestId, queryByTestId } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission as Submission} />
      </BaseComponent>
    );

    userEvent.click(getByTestId("collaborators-button"));

    await waitFor(() => expect(getByTestId("collaborators-dialog")).toBeVisible());

    userEvent.click(getByTestId("collaborators-dialog-close-icon-button"));

    await waitFor(() => expect(queryByTestId("collaborators-dialog")).not.toBeInTheDocument());
  });
});

describe("Implementation Requirements", () => {
  it("shows tooltip for 'Released' status in full history dialog", async () => {
    const dataSubmission = submissionFactory.build({
      status: "Completed",
      dataCommonsDisplayName: "DC-1",
      history: [
        submissionHistoryEventFactory.build({
          dateTime: "2023-12-02T10:00:00Z",
          status: "Completed",
        }),
        submissionHistoryEventFactory.build({
          dateTime: "2023-12-01T10:00:00Z",
          status: "Released",
        }),
        submissionHistoryEventFactory.build({
          dateTime: "2023-11-30T10:00:00Z",
          status: "Submitted",
        }),
      ],
    });

    const { getByText, findByText, queryByText } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission} />
      </BaseComponent>
    );

    userEvent.click(getByText("Full History"));

    const releasedStatus = await findByText(/Released/i);
    userEvent.hover(releasedStatus);

    expect(await findByText(/Released to DC-1/i)).toBeVisible();

    userEvent.unhover(releasedStatus);
    await waitFor(() => {
      expect(queryByText(/Released to DC-1/i)).not.toBeInTheDocument();
    });
  });

  it.each<SubmissionStatus>([
    "New",
    "In Progress",
    "Submitted",
    "Withdrawn",
    "Canceled",
    "Deleted",
    "Rejected",
    "Completed",
  ])("does not show tooltip for non-'Released' statuses in full history dialog", async (status) => {
    const dataSubmission = submissionFactory.build({
      status,
      dataCommonsDisplayName: "DC-1",
      history: [
        submissionHistoryEventFactory.build({
          dateTime: "2023-12-01T10:00:00Z",
          status,
        }),
        submissionHistoryEventFactory.build({
          dateTime: "2023-11-30T10:00:00Z",
          status: "In Progress",
        }),
      ],
    });

    const { getByText, queryByText, queryByRole } = render(
      <BaseComponent>
        <DataSubmissionSummary dataSubmission={dataSubmission} />
      </BaseComponent>
    );

    userEvent.click(getByText("Full History"));

    const statusText = getByText(status);
    userEvent.hover(statusText);
    await waitFor(() => {
      expect(queryByText(/Released to/i)).not.toBeInTheDocument();
      expect(queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });
});

describe("Edit Submission Name", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
  });

  it("A snackbar is displayed after successful name change", async () => {
    const dataSubmission = submissionFactory.build({ _id: "submission-id", name: "Old Name" });

    const editSubmissionMock: MockedResponse = {
      request: {
        query: EDIT_SUBMISSION,
        variables: { _id: "submission-id", newName: "New Name" },
      },
      result: {
        data: {
          editSubmission: {
            _id: "submission-id",
            name: "New Name",
            __typename: "Submission",
          },
        },
      },
    };

    const { getByTestId } = render(
      <BaseComponent mocks={[editSubmissionMock]}>
        <DataSubmissionSummary dataSubmission={dataSubmission} />
      </BaseComponent>
    );

    userEvent.click(getByTestId("edit-submission-name-icon"));
    const inputWrapper = getByTestId("edit-submission-name-dialog-input");
    const input = inputWrapper.querySelector("input");
    if (!input) throw new Error("Input not found in edit-submission-name-dialog-input");
    userEvent.clear(input);
    userEvent.type(input, "New Name");
    userEvent.click(getByTestId("edit-submission-name-dialog-save-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "The Data Submission name has been successfully changed.",
        expect.objectContaining({ variant: "success" })
      );
    });
  });

  it("The new name is displayed in summary after edits", async () => {
    const dataSubmission = submissionFactory.build({ _id: "submission-id", name: "Old Name" });

    const editSubmissionMock: MockedResponse = {
      request: {
        query: EDIT_SUBMISSION,
        variables: { _id: "submission-id", newName: "New Name" },
      },
      result: {
        data: {
          editSubmission: {
            _id: "submission-id",
            name: "New Name",
            __typename: "Submission",
          },
        },
      },
    };
    const updateQuery = vi.fn((updater: (state: typeof submissionCtxState.data) => unknown) =>
      updater({ getSubmission: { ...dataSubmission }, getSubmissionAttributes: null })
    );

    const submissionCtxState = {
      ...submissionCtxStateFactory.build(),
      data: {
        getSubmission: dataSubmission,
        getSubmissionAttributes: null,
      },
      updateQuery,
      status: SubmissionCtxStatus.LOADED,
      error: null,
    };

    const { getByTestId, rerender } = render(
      <BaseComponent mocks={[editSubmissionMock]} submissionCtxState={submissionCtxState}>
        <DataSubmissionSummary dataSubmission={dataSubmission} />
      </BaseComponent>
    );

    userEvent.click(getByTestId("edit-submission-name-icon"));
    const input = within(getByTestId("edit-submission-name-dialog-input")).getByRole("textbox");
    userEvent.clear(input);
    userEvent.type(input, "New Name");
    userEvent.click(getByTestId("edit-submission-name-dialog-save-button"));

    await waitFor(() => expect(updateQuery).toHaveBeenCalled());

    const updatedDataSubmission = { ...dataSubmission, name: "New Name" } as Submission;

    rerender(
      <BaseComponent mocks={[editSubmissionMock]} submissionCtxState={submissionCtxState}>
        <DataSubmissionSummary dataSubmission={updatedDataSubmission} />
      </BaseComponent>
    );

    await waitFor(() =>
      expect(getByTestId("submission-name-display")).toHaveTextContent("New Name")
    );
  });

  it("shows edit icon for primary submitter", () => {
    const dataSubmission = submissionFactory.build({ name: "Test", submitterID: "user1" });
    const user = userFactory.build({ _id: "user1" });
    const submissionCtxState = submissionCtxStateFactory.build();

    const { getByTestId } = render(
      <BaseComponent submissionCtxState={submissionCtxState} user={user}>
        <DataSubmissionSummary dataSubmission={dataSubmission} />
      </BaseComponent>
    );
    expect(getByTestId("edit-submission-name-icon")).toBeInTheDocument();
  });

  it("does not show edit icon for non-primary submitter", () => {
    const dataSubmission = submissionFactory.build({ name: "Test", submitterID: "user1" });
    const user = userFactory.build({ _id: "user2" });
    const submissionCtxState = submissionCtxStateFactory.build();

    const { queryByTestId } = render(
      <BaseComponent submissionCtxState={submissionCtxState} user={user}>
        <DataSubmissionSummary dataSubmission={dataSubmission} />
      </BaseComponent>
    );
    expect(queryByTestId("edit-submission-name-icon")).not.toBeInTheDocument();
  });
});
