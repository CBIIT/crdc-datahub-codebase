import userEvent from "@testing-library/user-event";
import { useMemo } from "react";
import { axe } from "vitest-axe";

import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import { render, waitFor } from "../../test-utils";
import {
  SubmissionContext,
  SubmissionCtxState,
  SubmissionCtxStatus,
} from "../Contexts/SubmissionContext";

import { ValidationStatus } from "./ValidationStatus";

type TestParentProps = {
  submission: Pick<
    Submission,
    "validationStarted" | "validationEnded" | "validationType" | "validationScope"
  >;
  children: React.ReactNode;
};

const TestParent: React.FC<TestParentProps> = ({ submission, children }) => {
  const value = useMemo<SubmissionCtxState>(
    () =>
      submissionCtxStateFactory.build({
        status: SubmissionCtxStatus.LOADED,
        error: null,
        data: {
          getSubmission: submissionFactory.build({
            validationStarted: undefined,
            validationEnded: undefined,
            validationType: undefined,
            validationScope: undefined,
            ...submission,
          }),
          submissionStats: {
            stats: [],
          },
          getSubmissionAttributes: null,
        },
      }),
    [submission]
  );

  return <SubmissionContext.Provider value={value}>{children}</SubmissionContext.Provider>;
};

describe("Accessibility", () => {
  it("should not have accessibility violations (Complete)", async () => {
    const { container } = render(
      <TestParent
        submission={{
          validationStarted: "2024-06-12T13:24:00Z",
          validationEnded: "2024-06-12T13:13:00Z",
          validationType: ["file"],
          validationScope: "All",
        }}
      >
        <ValidationStatus />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should not have accessibility violations (In Progress)", async () => {
    const { container } = render(
      <TestParent
        submission={{
          validationStarted: "2024-06-12T13:25:00Z",
          validationEnded: null,
          validationType: ["file"],
          validationScope: "All",
        }}
      >
        <ValidationStatus />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

// NOTE: We're testing component behavior here, not requirement-based behavior
describe("Basic Functionality", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should not crash if the submission is null", async () => {
    const { container } = render(
      <TestParent submission={null}>
        <ValidationStatus />
      </TestParent>
    );

    expect(container.firstChild).toBeNull();
  });

  it("should not appear for a new submission without validation history", async () => {
    const { container, getByTestId } = render(
      <TestParent
        submission={{
          validationStarted: null,
          validationEnded: null,
          validationType: null,
          validationScope: null,
        }}
      >
        <ValidationStatus />
      </TestParent>
    );

    expect(container.firstChild).toBeNull();
    expect(() => getByTestId("validation-status-chip")).toThrow();
  });

  it.each([[], null, undefined, NaN])(
    "should not appear for a submission with validationType %s",
    async (validationType) => {
      const { container, getByTestId } = render(
        <TestParent
          submission={{
            validationStarted: null,
            validationEnded: null,
            validationScope: null,
            // @ts-expect-error Testing invalid values
            validationType,
          }}
        >
          <ValidationStatus />
        </TestParent>
      );

      expect(container.firstChild).toBeNull();
      expect(() => getByTestId("validation-status-chip")).toThrow();
    }
  );

  it("should rerender when the validation state changes", async () => {
    const { getByText, rerender } = render(
      <TestParent
        submission={{
          validationStarted: "2024-06-12T13:31:00Z",
          validationEnded: null,
          validationType: ["metadata"],
          validationScope: "All",
        }}
      >
        <ValidationStatus />
      </TestParent>
    );

    expect(getByText(/validation in-progress/i)).toBeInTheDocument();

    rerender(
      <TestParent
        submission={{
          validationStarted: "2024-06-12T13:31:00Z",
          validationEnded: "2024-06-12T13:35:00Z",
          validationType: ["metadata"],
          validationScope: "All",
        }}
      >
        <ValidationStatus />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText(/validation completed/i)).toBeInTheDocument();
    });
  });
});

describe("Implementation Requirements", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should have a tooltip appear on hover", async () => {
    const { getByTestId, findByRole } = render(
      <TestParent
        submission={{
          validationStarted: "2024-06-12T13:35:00Z",
          validationEnded: "2024-06-12T13:37:00Z",
          validationType: ["metadata", "file"],
          validationScope: "All",
        }}
      >
        <ValidationStatus />
      </TestParent>
    );

    userEvent.hover(getByTestId("validation-status-chip"));

    // NOTE: We're just asserting that the tooltip is present on hover
    // the text content of the tooltip is tested below
    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
  });

  it("should indicate that validation is ongoing with an icon and chip", () => {
    const { getByTestId } = render(
      <TestParent
        submission={{
          validationStarted: "2024-06-12T13:42:00Z",
          validationEnded: null,
          validationType: ["file"],
          validationScope: "New",
        }}
      >
        <ValidationStatus />
      </TestParent>
    );

    expect(getByTestId("validation-status-icon")).toBeInTheDocument();
    expect(getByTestId("validation-status-chip")).toHaveStyle("color: #903813");
    expect(getByTestId("validation-status-chip")).toBeInTheDocument();
    expect(getByTestId("validation-status-chip")).toHaveTextContent(/validation in-progress.../i);
  });

  it("should indicate that validation is complete with an icon and chip", () => {
    const { getByTestId } = render(
      <TestParent
        submission={{
          validationStarted: "2024-06-12T13:43:00Z",
          validationEnded: "2024-06-12T13:44:00Z",
          validationType: ["file"],
          validationScope: "New",
        }}
      >
        <ValidationStatus />
      </TestParent>
    );

    expect(getByTestId("validation-status-icon")).toBeInTheDocument();
    expect(getByTestId("validation-status-chip")).toHaveStyle("color: #165848");
    expect(getByTestId("validation-status-chip")).toBeInTheDocument();
    expect(getByTestId("validation-status-chip")).toHaveTextContent(/validation completed/i);
  });

  it("should format the Validation Type of 'files' as 'Data Files'", async () => {
    const { getByTestId, findByRole } = render(
      <TestParent
        submission={{
          validationStarted: "2024-06-18T14:45:00Z",
          validationEnded: null,
          validationType: ["file"],
          validationScope: "New",
        }}
      >
        <ValidationStatus />
      </TestParent>
    );

    userEvent.hover(getByTestId("validation-status-chip"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toHaveTextContent(/Type: Data Files/);
  });

  it.each<
    Pick<
      Submission,
      "validationStarted" | "validationEnded" | "validationType" | "validationScope"
    > & { expected: string }
  >([
    // Running – Metadata – New
    {
      expected:
        "The validation (Type: Metadata, Target: New Uploaded Data) started on 06-12-2024 at 01:53 PM and is still in progress...",
      validationStarted: "2024-06-12T13:53:00Z",
      validationEnded: null,
      validationType: ["metadata"],
      validationScope: "New",
    },
    // Running - File - New
    {
      expected:
        "The validation (Type: Data Files, Target: New Uploaded Data) started on 06-12-2024 at 01:54 PM and is still in progress...",
      validationStarted: "2024-06-12T13:54:00Z",
      validationEnded: null,
      validationType: ["file"],
      validationScope: "New",
    },
    // Running - Both - New
    {
      expected:
        "The validation (Type: Both, Target: New Uploaded Data) started on 06-12-2024 at 01:55 PM and is still in progress...",
      validationStarted: "2024-06-12T13:55:03Z",
      validationEnded: null,
      validationType: ["metadata", "file"],
      validationScope: "New",
    },
    // Running - Both - All
    {
      expected:
        "The validation (Type: Both, Target: All Uploaded Data) started on 06-12-2024 at 01:56 PM and is still in progress...",
      validationStarted: "2024-06-12T13:56:09Z",
      validationEnded: null,
      validationType: ["metadata", "file"],
      validationScope: "All",
    },
    // Complete - Metadata - New
    {
      expected:
        "The last validation (Type: Metadata, Target: New Uploaded Data) that ran on 06-12-2024 at 01:57 PM was completed on 06-12-2024 at 01:58 PM.",
      validationStarted: "2024-06-12T13:57:00Z",
      validationEnded: "2024-06-12T13:58:22Z",
      validationType: ["metadata"],
      validationScope: "New",
    },
    // Complete - File - New
    {
      expected:
        "The last validation (Type: Data Files, Target: New Uploaded Data) that ran on 06-12-2024 at 01:59 PM was completed on 06-12-2024 at 02:00 PM.",
      validationStarted: "2024-06-12T13:59:00Z",
      validationEnded: "2024-06-12T14:00:00Z",
      validationType: ["file"],
      validationScope: "New",
    },
    // Complete - Both - New
    {
      expected:
        "The last validation (Type: Both, Target: New Uploaded Data) that ran on 06-12-2024 at 02:01 PM was completed on 06-12-2024 at 02:02 PM.",
      validationStarted: "2024-06-12T14:01:00Z",
      validationEnded: "2024-06-12T14:02:00Z",
      validationType: ["metadata", "file"],
      validationScope: "New",
    },
    // Complete - Both - All
    {
      expected:
        "The last validation (Type: Both, Target: All Uploaded Data) that ran on 06-12-2024 at 02:03 PM was completed on 06-12-2024 at 02:04 PM.",
      validationStarted: "2024-06-12T14:03:00Z",
      validationEnded: "2024-06-12T14:04:00Z",
      validationType: ["metadata", "file"],
      validationScope: "All",
    },
  ])(
    `should correctly format the tooltip text based on the most recent validation state`,
    async ({ expected, ...submission }) => {
      const { getByTestId, findByRole } = render(
        <TestParent submission={submission}>
          <ValidationStatus />
        </TestParent>
      );

      userEvent.hover(getByTestId("validation-status-chip"));

      const tooltip = await findByRole("tooltip");
      expect(tooltip).toHaveTextContent(expected, { normalizeWhitespace: false });
    }
  );
});
