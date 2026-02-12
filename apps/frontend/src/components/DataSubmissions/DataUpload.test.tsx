import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { collaboratorFactory } from "@/factories/submission/CollaboratorFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import { RETRIEVE_CLI_CONFIG, RetrieveCLIConfigResp } from "../../graphql";
import { TestRouter, act, render, waitFor } from "../../test-utils";
import { Context as AuthCtx, ContextState as AuthCtxState } from "../Contexts/AuthContext";

import { DataUpload } from "./DataUpload";

vi.mock(import("../../env"), async (importOriginal) => {
  const mod = await importOriginal();

  return {
    default: {
      ...mod.default,
      VITE_BACKEND_API: "mocked-backend-api-url",
      VITE_UPLOADER_CLI_VERSION: "2.3-alpha-6",
    },
  };
});

const mockDownloadBlob = vi.fn();
vi.mock("../../utils", async () => ({
  ...(await vi.importActual("../../utils")),
  downloadBlob: (...args) => mockDownloadBlob(...args),
}));

type ParentProps = {
  mocks?: MockedResponse[];
  role?: UserRole;
  permissions?: AuthPermissions[];
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  mocks = [],
  role = "Submitter",
  permissions = ["data_submission:view", "data_submission:create"],
  children,
}) => {
  const authCtxState: AuthCtxState = useMemo<AuthCtxState>(
    () =>
      authCtxStateFactory.build({
        user: userFactory.build({ _id: "current-user", role, permissions }),
      }),
    [role]
  );

  return (
    <MockedProvider mocks={mocks} addTypename={false}>
      <AuthCtx.Provider value={authCtxState}>
        <TestRouter basename="">{children}</TestRouter>
      </AuthCtx.Provider>
    </MockedProvider>
  );
};

describe("Accessibility", () => {
  it("should have no violations", async () => {
    const { container } = render(
      <TestParent>
        <DataUpload submission={submissionFactory.build({ _id: "accessibility-base" })} />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    const { getByTestId } = render(
      <TestParent>
        <DataUpload
          submission={submissionFactory.build({
            _id: "smoke-test-id",
            submitterID: "current-user",
          })}
        />
      </TestParent>
    );

    expect(getByTestId("uploader-cli-footer")).toBeVisible();
  });

  it("should render the CLI version with tooltip and opens CLI dialog", async () => {
    const { getByTestId, getByRole, queryByRole } = render(
      <TestParent>
        <DataUpload
          submission={submissionFactory.build({
            _id: "smoke-test-id",
            submitterID: "current-user",
          })}
        />
      </TestParent>
    );

    expect(getByTestId("uploader-cli-version-wrapper").textContent).toBe(
      "Uploader CLI Version: v2.3"
    );

    expect(queryByRole("tooltip")).not.toBeInTheDocument();

    const cliVersionButton = getByTestId("uploader-cli-version-button");

    userEvent.hover(cliVersionButton);

    await waitFor(() => {
      expect(getByRole("tooltip")).toBeInTheDocument();
    });

    userEvent.click(cliVersionButton);

    await waitFor(() => {
      expect(getByTestId("uploader-cli-dialog")).toBeInTheDocument();
    });
  });

  it("should not crash when the submission is null", () => {
    const { getByText } = render(
      <TestParent>
        <DataUpload submission={null} />
      </TestParent>
    );

    expect(getByText("Upload Data Files")).toBeVisible();
  });

  it("should handle API network errors gracefully", async () => {
    const mocks: MockedResponse<RetrieveCLIConfigResp>[] = [
      {
        request: {
          query: RETRIEVE_CLI_CONFIG,
        },
        variableMatcher: () => true,
        error: new Error("Simulated network error"),
      },
    ];

    const { getByTestId, getByText } = render(
      <TestParent mocks={mocks}>
        <DataUpload
          submission={submissionFactory.build({
            _id: "network-error-handling",
            submitterID: "current-user",
          })}
        />
      </TestParent>
    );

    // Open the dialog
    userEvent.click(getByTestId("uploader-cli-config-button"));

    userEvent.type(getByTestId("uploader-config-dialog-input-data-folder"), "test-folder");
    userEvent.type(getByTestId("uploader-config-dialog-input-manifest"), "test-manifest");

    userEvent.click(getByText("Download"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Unable to download Uploader CLI config file",
        {
          variant: "error",
        }
      );
    });
  });

  it("should handle API GraphQL errors gracefully", async () => {
    const mocks: MockedResponse<RetrieveCLIConfigResp>[] = [
      {
        request: {
          query: RETRIEVE_CLI_CONFIG,
        },
        variableMatcher: () => true,
        result: {
          errors: [new GraphQLError("Simulated GraphQL error")],
        },
      },
    ];

    const { getByTestId, getByText } = render(
      <TestParent mocks={mocks}>
        <DataUpload
          submission={submissionFactory.build({
            _id: "graphql-error-handling",
            submitterID: "current-user",
          })}
        />
      </TestParent>
    );

    // Open the dialog
    userEvent.click(getByTestId("uploader-cli-config-button"));

    userEvent.type(getByTestId("uploader-config-dialog-input-data-folder"), "test-folder");
    userEvent.type(getByTestId("uploader-config-dialog-input-manifest"), "test-manifest");

    // eslint-disable-next-line testing-library/no-unnecessary-act -- RHF is throwing an error without act
    await act(async () => {
      userEvent.click(getByText("Download"));
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Unable to download Uploader CLI config file",
        {
          variant: "error",
        }
      );
    });
  });

  it("should hide the CLI Configuration dialog when onClose is called", async () => {
    const { getByTestId, findAllByRole, queryByRole } = render(
      <TestParent mocks={[]}>
        <DataUpload
          submission={submissionFactory.build({
            _id: "hide-config-dialog-on-close",
            dataType: "Metadata and Data Files",
            submitterID: "current-user",
          })}
        />
      </TestParent>
    );

    // Open the dialog
    userEvent.click(getByTestId("uploader-cli-config-button"));

    const dialog = await findAllByRole("presentation");

    expect(dialog[1]).toBeVisible();

    // Close the dialog
    userEvent.click(dialog[1]);

    await waitFor(() => {
      expect(queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("should hide the Uploader CLI dialog when onClose is called", async () => {
    const { getByTestId, findAllByRole, queryByRole } = render(
      <TestParent mocks={[]}>
        <DataUpload
          submission={submissionFactory.build({
            _id: "hide-cli-dialog-on-close",
            submitterID: "current-user",
          })}
        />
      </TestParent>
    );

    // Open the dialog
    userEvent.click(getByTestId("uploader-cli-download-button"));

    const dialog = await findAllByRole("presentation");

    expect(dialog[1]).toBeVisible();

    // Close the dialog
    userEvent.click(dialog[1]);

    await waitFor(() => {
      expect(queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

describe("Implementation Requirements", () => {
  it("should have the Uploader CLI download dialog button", async () => {
    const { getByText, getByTestId } = render(
      <TestParent>
        <DataUpload
          submission={submissionFactory.build({
            _id: "cli-download-link-id",
            submitterID: "current-user",
          })}
        />
      </TestParent>
    );

    const link = getByTestId("uploader-cli-download-button");

    expect(getByText(/CLI Tool download/i)).toBeVisible();
    expect(link).toContainElement(getByText(/CLI Tool download/i));

    userEvent.click(link);

    await waitFor(() => {
      expect(getByText(/Uploader CLI Tool/i)).toBeInTheDocument();
    });
  });

  it("should have the Configuration download link when 'Metadata and Data Files' dataType", async () => {
    const mocks: MockedResponse[] = [];

    const { getByText, getByTestId } = render(
      <TestParent mocks={mocks}>
        <DataUpload
          submission={submissionFactory.build({
            _id: "config-download-link-id",
            dataType: "Metadata and Data Files",
            submitterID: "current-user",
          })}
        />
      </TestParent>
    );
    const button = getByTestId("uploader-cli-config-button");

    expect(getByText(/download configuration file/i)).toBeVisible();
    expect(button).toBeVisible();
  });

  it("should enable the Uploader CLI download button when user has required permissions", async () => {
    const { getByTestId } = render(
      <DataUpload
        submission={submissionFactory.build({
          _id: "config-download-role-check",
          dataType: "Metadata and Data Files", // NOTE: Required for the button to show
          submitterID: "current-user",
        })}
      />,
      {
        wrapper: (p) => (
          <TestParent {...p} permissions={["data_submission:view", "data_submission:create"]} />
        ),
      }
    );

    expect(getByTestId("uploader-cli-config-button")).toBeEnabled();
  });

  it("should disable the Uploader CLI download button when user is missing required permissions", async () => {
    const { getByTestId } = render(
      <DataUpload
        submission={submissionFactory.build({
          _id: "config-download-role-check",
          dataType: "Metadata and Data Files", // NOTE: Required for the button to show
          submitterID: "current-user",
        })}
      />,
      { wrapper: (p) => <TestParent {...p} permissions={[]} /> }
    );

    expect(getByTestId("uploader-cli-config-button")).toBeDisabled();
  });

  it("should enable the Uploader CLI download button when user is a collaborator", async () => {
    const { getByTestId } = render(
      <DataUpload
        submission={submissionFactory.build({
          _id: "config-download-check",
          dataType: "Metadata and Data Files", // NOTE: Required for the button to show
          submitterID: "some-other-user",
          collaborators: [
            collaboratorFactory.build({
              collaboratorID: "current-user",
              collaboratorName: "",
              permission: "Can Edit",
            }),
          ],
        })}
      />,
      { wrapper: (p) => <TestParent {...p} role="Submitter" /> }
    );

    expect(getByTestId("uploader-cli-config-button")).toBeEnabled();
  });

  it("should render alt CLI footer when 'Metadata Only' dataType", async () => {
    const mocks: MockedResponse[] = [];

    const { getByText, getByTestId } = render(
      <TestParent mocks={mocks}>
        <DataUpload
          submission={submissionFactory.build({
            _id: "config-download-link-id",
            dataType: "Metadata Only",
            submitterID: "current-user",
          })}
        />
      </TestParent>
    );

    expect(getByTestId("uploader-cli-footer-alt")).toBeVisible();
    expect(
      getByText(/This submission is for metadata only; there is no need to upload data files./i)
    ).toBeVisible();
  });

  it("should download the Uploader CLI configuration file on click", async () => {
    let called = false;
    const mocks: MockedResponse<RetrieveCLIConfigResp>[] = [
      {
        request: {
          query: RETRIEVE_CLI_CONFIG,
        },
        variableMatcher: () => true,
        result: () => {
          called = true;

          return {
            data: {
              retrieveCLIConfig: `abc_file_one=123\nline_two=456\nline_three=789\n`,
            },
          };
        },
      },
    ];

    const { getByTestId, getByText } = render(
      <TestParent mocks={mocks}>
        <DataUpload
          submission={submissionFactory.build({
            _id: "cli-download-on-click",
            submitterID: "current-user",
          })}
        />
      </TestParent>
    );

    expect(called).toBe(false);

    // eslint-disable-next-line testing-library/no-unnecessary-act -- RHF is throwing an error without act
    await act(async () => {
      // Open the dialog
      userEvent.click(getByTestId("uploader-cli-config-button"));
    });

    userEvent.type(getByTestId("uploader-config-dialog-input-data-folder"), "test-folder");
    userEvent.type(getByTestId("uploader-config-dialog-input-manifest"), "test-manifest");

    // eslint-disable-next-line testing-library/no-unnecessary-act -- RHF is throwing an error without act
    await act(async () => {
      userEvent.click(getByText("Download"));
    });

    await waitFor(() => {
      expect(called).toBe(true);
    });
  });

  it.each<{ input: string; expected: string }>([
    { input: "A B C 1 2 3", expected: "cli-config-A-B-C-1-2-3.yml" },
    { input: "long name".repeat(100), expected: `cli-config-${"long-name".repeat(100)}.yml` },
    { input: "", expected: "cli-config.yml" }, // NOTE: empty string should default to "cli-config.yml"
    { input: `non $alpha name $@!819`, expected: "cli-config-non-alpha-name-819.yml" },
    { input: "  ", expected: "cli-config.yml" }, // NOTE: empty whitespace is trimmed down to nothing
    { input: `_-"a-b+c=d`, expected: "cli-config--a-bcd.yml" },
    { input: "CRDCDH-1234", expected: "cli-config-CRDCDH-1234.yml" },
    { input: "SPACE-AT-END ", expected: "cli-config-SPACE-AT-END.yml" },
  ])(
    "should safely name the Uploader CLI config file based on the submission name '%s'",
    async ({ input, expected }) => {
      const mocks: MockedResponse<RetrieveCLIConfigResp>[] = [
        {
          request: {
            query: RETRIEVE_CLI_CONFIG,
          },
          variableMatcher: () => true,
          result: {
            data: {
              retrieveCLIConfig: `abc_file_one=123\nline_two=456\nline_three=789\n`,
            },
          },
        },
      ];

      const { getByTestId, getByText } = render(
        <TestParent mocks={mocks}>
          <DataUpload
            submission={submissionFactory.build({
              _id: "safe-filename-test",
              name: input,
              submitterID: "current-user",
            })}
          />
        </TestParent>
      );

      // Open the dialog
      userEvent.click(getByTestId("uploader-cli-config-button"));

      userEvent.type(getByTestId("uploader-config-dialog-input-data-folder"), "test-folder");
      userEvent.type(getByTestId("uploader-config-dialog-input-manifest"), "test-manifest");

      // eslint-disable-next-line testing-library/no-unnecessary-act -- RHF is throwing an error without act
      await act(async () => {
        userEvent.click(getByText("Download"));
      });

      await waitFor(() => {
        expect(mockDownloadBlob).toHaveBeenCalledWith(
          expect.any(String),
          expected,
          "application/yaml"
        );
      });
    }
  );
});
