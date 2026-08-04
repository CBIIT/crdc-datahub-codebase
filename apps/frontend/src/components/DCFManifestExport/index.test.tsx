import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { useMemo } from "react";
import { axe } from "vitest-axe";

import { Context as AuthContext } from "@/components/Contexts/AuthContext";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import {
  DOWNLOAD_DCF_MANIFEST,
  DownloadDCFManifestInput,
  DownloadDCFManifestResp,
  GetSubmissionResp,
} from "@/graphql";
import { render, waitFor } from "@/test-utils";

import {
  SubmissionContext,
  SubmissionCtxState,
  SubmissionCtxStatus,
} from "../Contexts/SubmissionContext";

import Button from "./index";

type MockParentProps = {
  submission: Partial<GetSubmissionResp["getSubmission"]> &
    Pick<GetSubmissionResp["getSubmission"], "_id">;
  mocks: MockedResponse[];
  user?: User;
  children: React.ReactNode;
};

const MockParent: React.FC<MockParentProps> = ({ submission, mocks, user, children }) => {
  const authState = useMemo(
    () =>
      authCtxStateFactory.build({
        isLoggedIn: true,
        user:
          user ||
          userFactory.build({
            role: "Admin",
            permissions: ["data_submission:review"],
          }),
      }),
    [user]
  );

  const ctxState = useMemo<SubmissionCtxState>(
    () =>
      submissionCtxStateFactory.build({
        data: {
          getSubmission: submissionFactory.build({
            _id: undefined,
            status: "Submitted",
            dataType: "Metadata and Data Files",
            ...submission,
          }),
          getSubmissionAttributes: null,
          submissionStats: null,
        },
        status: SubmissionCtxStatus.LOADED,
        error: null,
      }),
    [submission]
  );

  return (
    <MockedProvider mocks={mocks} addTypename={false}>
      <AuthContext.Provider value={authState}>
        <SubmissionContext.Provider value={ctxState}>{children}</SubmissionContext.Provider>
      </AuthContext.Provider>
    </MockedProvider>
  );
};

describe("Accessibility", () => {
  it("should have no accessibility violations", async () => {
    const { container, getByTestId } = render(<Button />, {
      wrapper: ({ children }) => (
        <MockParent submission={{ _id: "mock-accessibility" }} mocks={[]}>
          {children}
        </MockParent>
      ),
    });

    expect(getByTestId("dcf-manifest-export-button")).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations when disabled", async () => {
    const { container, getByTestId } = render(<Button disabled />, {
      wrapper: ({ children }) => (
        <MockParent submission={{ _id: "mock-accessibility" }} mocks={[]}>
          {children}
        </MockParent>
      ),
    });

    expect(getByTestId("dcf-manifest-export-button")).toBeDisabled();

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    const { container } = render(<Button />, {
      wrapper: ({ children }) => (
        <MockParent submission={{ _id: null }} mocks={[]}>
          {children}
        </MockParent>
      ),
    });

    expect(container).toBeInTheDocument();
  });

  it("should not render when submission id is missing", () => {
    const { queryByTestId } = render(<Button />, {
      wrapper: ({ children }) => (
        <MockParent submission={{ _id: null }} mocks={[]}>
          {children}
        </MockParent>
      ),
    });

    expect(queryByTestId("dcf-manifest-export-button")).not.toBeInTheDocument();
  });

  it("should not render when user does not have review permission", () => {
    const { queryByTestId } = render(<Button />, {
      wrapper: ({ children }) => (
        <MockParent
          submission={{ _id: "mock-no-permission" }}
          mocks={[]}
          user={userFactory.build({
            role: "Admin",
            permissions: [],
          })}
        >
          {children}
        </MockParent>
      ),
    });

    expect(queryByTestId("dcf-manifest-export-button")).not.toBeInTheDocument();
  });

  it("should not render when submission status is not downloadable", () => {
    const { queryByTestId } = render(<Button />, {
      wrapper: ({ children }) => (
        <MockParent submission={{ _id: "mock-new", status: "New" }} mocks={[]}>
          {children}
        </MockParent>
      ),
    });

    expect(queryByTestId("dcf-manifest-export-button")).not.toBeInTheDocument();
  });

  it("should not render when submission data type is not Metadata and Data Files", () => {
    const { queryByTestId } = render(<Button />, {
      wrapper: ({ children }) => (
        <MockParent
          submission={{ _id: "mock-metadata-only", dataType: "Metadata Only" }}
          mocks={[]}
        >
          {children}
        </MockParent>
      ),
    });

    expect(queryByTestId("dcf-manifest-export-button")).not.toBeInTheDocument();
  });

  it("should forward supported attributes to the button", () => {
    const { getByTestId } = render(<Button aria-details="mock-details" name="mock-name" />, {
      wrapper: ({ children }) => (
        <MockParent submission={{ _id: "mock-attributes-check" }} mocks={[]}>
          {children}
        </MockParent>
      ),
    });

    const button = getByTestId("dcf-manifest-export-button");
    expect(button).toHaveAttribute("aria-details", "mock-details");
    expect(button).toHaveAttribute("name", "mock-name");
  });

  it("should handle API errors gracefully (GraphQL)", async () => {
    const mock: MockedResponse<DownloadDCFManifestResp, DownloadDCFManifestInput> = {
      request: {
        query: DOWNLOAD_DCF_MANIFEST,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("mock error")],
      },
    };

    const { getByTestId } = render(<Button />, {
      wrapper: ({ children }) => (
        <MockParent submission={{ _id: "mock-graph-error" }} mocks={[mock]}>
          {children}
        </MockParent>
      ),
    });

    userEvent.click(getByTestId("dcf-manifest-export-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("mock error", { variant: "error" });
    });
  });

  it("should handle API errors gracefully (Network)", async () => {
    const mock: MockedResponse<DownloadDCFManifestResp, DownloadDCFManifestInput> = {
      request: {
        query: DOWNLOAD_DCF_MANIFEST,
      },
      variableMatcher: () => true,
      error: new Error("Network error"),
    };

    const { getByTestId } = render(<Button />, {
      wrapper: ({ children }) => (
        <MockParent submission={{ _id: "mock-network-error" }} mocks={[mock]}>
          {children}
        </MockParent>
      ),
    });

    userEvent.click(getByTestId("dcf-manifest-export-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Network error", { variant: "error" });
    });
  });

  it("should handle API errors gracefully (API Misc)", async () => {
    const mock: MockedResponse<DownloadDCFManifestResp, DownloadDCFManifestInput> = {
      request: {
        query: DOWNLOAD_DCF_MANIFEST,
      },
      variableMatcher: () => true,
      result: {
        data: {
          downloadDCFManifest: null,
        },
      },
    };

    const { getByTestId } = render(<Button />, {
      wrapper: ({ children }) => (
        <MockParent submission={{ _id: "mock-api-error" }} mocks={[mock]}>
          {children}
        </MockParent>
      ),
    });

    userEvent.click(getByTestId("dcf-manifest-export-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Oops! The API did not return a download link.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should open download link when API request succeeds", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(
      () =>
        ({
          close: () => {},
        }) as Window
    );

    const mock: MockedResponse<DownloadDCFManifestResp, DownloadDCFManifestInput> = {
      request: {
        query: DOWNLOAD_DCF_MANIFEST,
      },
      variableMatcher: () => true,
      result: {
        data: {
          downloadDCFManifest: "https://example.com/dcf-manifest.tsv",
        },
      },
    };

    const { getByTestId } = render(<Button />, {
      wrapper: ({ children }) => (
        <MockParent submission={{ _id: "mock-success" }} mocks={[mock]}>
          {children}
        </MockParent>
      ),
    });

    userEvent.click(getByTestId("dcf-manifest-export-button"));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        "https://example.com/dcf-manifest.tsv",
        "_blank",
        "noopener,noreferrer"
      );
    });

    openSpy.mockRestore();
  });
});
