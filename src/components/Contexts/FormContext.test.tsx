import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { GraphQLError } from "graphql";
import React, { FC } from "react";

import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { questionnaireDataFactory } from "@/factories/application/QuestionnaireDataFactory";

import {
  APPROVE_APP,
  ApproveAppInput,
  ApproveAppResp,
  GetAppResp,
  INQUIRE_APP,
  InquireAppResp,
  REJECT_APP,
  REOPEN_APP,
  RejectAppResp,
  ReopenAppResp,
  SAVE_APP,
  SaveAppInput,
  SaveAppResp,
} from "../../graphql";
import { query as GET_APP, GetAppInput } from "../../graphql/getApplication";
import { query as GET_LAST_APP } from "../../graphql/getMyLastApplication";
import { act, render, renderHook, waitFor } from "../../test-utils";

import { Status as FormStatus, FormProvider, useFormContext } from "./FormContext";

const baseApplication: Omit<Application, "questionnaireData"> = applicationFactory.build({
  questionnaireData: undefined,
});

type Props = {
  appId: string;
  mocks?: MockedResponse[];
  children?: React.ReactNode;
};

const TestChild: FC = () => {
  const { status, data, error } = useFormContext();
  const { _id, questionnaireData } = data ?? {};

  if (status === FormStatus.LOADING) {
    return null;
  }

  return (
    <>
      {/* Generic Context Details  */}
      {status && <div data-testid="status">{status}</div>}
      {error && <div data-testid="error">{error}</div>}

      {/* API Data */}
      {_id && <div data-testid="app-id">{_id}</div>}
      {typeof questionnaireData?.pi?.firstName === "string" && (
        <div data-testid="pi-first-name">{questionnaireData.pi.firstName}</div>
      )}
      {typeof questionnaireData?.pi?.lastName === "string" && (
        <div data-testid="pi-last-name">{questionnaireData.pi.lastName}</div>
      )}
    </>
  );
};

const TestParent: FC<Props> = ({ mocks, appId, children }: Props) => (
  <MockedProvider mocks={mocks}>
    <FormProvider id={appId}>{children ?? <TestChild />}</FormProvider>
  </MockedProvider>
);

describe("FormContext > useFormContext Tests", () => {
  it("should throw an exception when used outside of a FormProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestChild />)).toThrow(
      "FormContext cannot be used outside of the FormProvider component"
    );
    vi.spyOn(console, "error").mockRestore();
  });
});

describe("FormContext > FormProvider Tests", () => {
  it("should return an error for empty IDs", async () => {
    const { findByTestId, getByTestId } = render(<TestParent appId="" />);

    await findByTestId("error");

    expect(getByTestId("status").textContent).toEqual(FormStatus.ERROR);
    expect(getByTestId("error").textContent).toEqual("Invalid application ID provided");
  });

  it("should return an error for graphql-based failures", async () => {
    const mocks = [
      {
        request: {
          query: GET_APP,
          variables: {
            id: "556ac14a-f247-42e8-8878-8468060fb49a",
          },
        },
        result: {
          errors: [new GraphQLError("Test GraphQL error")],
        },
      },
    ];
    const { findByTestId, getByTestId } = render(
      <TestParent mocks={mocks} appId="556ac14a-f247-42e8-8878-8468060fb49a" />
    );

    await findByTestId("error");

    expect(getByTestId("status").textContent).toEqual(FormStatus.ERROR);
    expect(getByTestId("error").textContent).toEqual("An unknown API or GraphQL error occurred");
  });

  it("should return an error for network-based failures", async () => {
    const mocks = [
      {
        request: {
          query: GET_APP,
          variables: {
            id: "556ac14a-f247-42e8-8878-8468060fb49a",
          },
        },
        error: new Error("Test network error"),
      },
    ];
    const { findByTestId, getByTestId } = render(
      <TestParent mocks={mocks} appId="556ac14a-f247-42e8-8878-8468060fb49a" />
    );

    await findByTestId("error");

    expect(getByTestId("status").textContent).toEqual(FormStatus.ERROR);
    expect(getByTestId("error").textContent).toEqual("An unknown API or GraphQL error occurred");
  });

  it("should return data for nominal requests", async () => {
    const mocks = [
      {
        request: {
          query: GET_APP,
          variables: {
            id: "556ac14a-f247-42e8-8878-8468060fb49a",
          },
        },
        result: {
          data: {
            getApplication: {
              _id: "556ac14a-f247-42e8-8878-8468060fb49a",
              questionnaireData: JSON.stringify({
                sections: [{ name: "A", status: "In Progress" }],
                pi: {
                  firstName: "Successfully",
                  lastName: "Fetched",
                },
              }),
            },
          },
        },
      },
    ];
    const { findByTestId, getByTestId } = render(
      <TestParent mocks={mocks} appId="556ac14a-f247-42e8-8878-8468060fb49a" />
    );

    await findByTestId("status");

    expect(getByTestId("status").textContent).toEqual(FormStatus.LOADED);
    expect(getByTestId("app-id").textContent).toEqual("556ac14a-f247-42e8-8878-8468060fb49a");
    expect(getByTestId("pi-first-name").textContent).toEqual("Successfully");
    expect(getByTestId("pi-last-name").textContent).toEqual("Fetched");
  });

  it("should autofill PI details if Section A is not started", async () => {
    const mocks = [
      {
        request: {
          query: GET_LAST_APP,
        },
        result: {
          data: {
            getMyLastApplication: {
              _id: "ABC-LAST-ID-123",
              questionnaireData: JSON.stringify({
                pi: {
                  firstName: "Test",
                  lastName: "User",
                },
              }),
            },
          },
        },
      },
      {
        request: {
          query: GET_APP,
          variables: {
            id: "AAA-BBB-EXISTING-APP",
          },
        },
        result: {
          data: {
            getApplication: {
              _id: "AAA-BBB-EXISTING-APP",
              questionnaireData: JSON.stringify({}),
            },
          },
        },
      },
    ];
    const { findByTestId, getByTestId } = render(
      <TestParent mocks={mocks} appId="AAA-BBB-EXISTING-APP" />
    );

    await findByTestId("status");

    expect(getByTestId("status").textContent).toEqual(FormStatus.LOADED);
    expect(getByTestId("pi-first-name").textContent).toEqual("Test");
    expect(getByTestId("pi-last-name").textContent).toEqual("User");
  });

  it("should not execute getMyLastApplication if Section A is started", async () => {
    const mocks = [
      {
        request: {
          query: GET_LAST_APP,
        },
        result: {
          data: {
            getMyLastApplication: {
              _id: "ABC-LAST-ID-123",
              questionnaireData: JSON.stringify({
                pi: {
                  firstName: "Should not be",
                  lastName: "Used or called",
                },
              }),
            },
          },
        },
      },
      {
        request: {
          query: GET_APP,
          variables: {
            id: "AAA-BBB-EXISTING-APP",
          },
        },
        result: {
          data: {
            getApplication: {
              _id: "AAA-BBB-EXISTING-APP",
              questionnaireData: JSON.stringify({
                sections: [{ name: "A", status: "In Progress" }],
              }),
            },
          },
        },
      },
    ];
    const { findByTestId, getByTestId } = render(
      <TestParent mocks={mocks} appId="AAA-BBB-EXISTING-APP" />
    );

    await findByTestId("status");

    expect(getByTestId("status").textContent).toEqual(FormStatus.LOADED);
    expect(getByTestId("pi-first-name").textContent).toEqual("");
    expect(getByTestId("pi-last-name").textContent).toEqual("");
  });
});

describe("approveForm Tests", () => {
  const getAppMock: MockedResponse<GetAppResp> = {
    request: {
      query: GET_APP,
    },
    variableMatcher: () => true,
    result: {
      data: {
        getApplication: {
          ...baseApplication,
          questionnaireData: JSON.stringify(
            questionnaireDataFactory.build({
              sections: [{ name: "A", status: "In Progress" }], // To prevent fetching lastApp
            })
          ),
        },
      },
    },
  };

  it("should send an approve request to the API", async () => {
    const appId = "556ac14a-f247-42e8-8878-8468060fb49a";

    const mockVariableMatcher = vi.fn().mockImplementation(() => true);
    const mock: MockedResponse<ApproveAppResp, ApproveAppInput> = {
      request: {
        query: APPROVE_APP,
      },
      variableMatcher: mockVariableMatcher,
      result: {
        data: {
          approveApplication: {
            _id: appId,
          },
        },
      },
    };

    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => (
        <TestParent mocks={[getAppMock, mock]} appId={appId}>
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(FormStatus.LOADED);
    });

    await act(async () => {
      const approveResp = await result.current.approveForm(
        { reviewComment: "mock approval comment", pendingModelChange: false },
        true
      );
      expect(approveResp).toEqual({
        status: "success",
        id: appId,
      });
      expect(mockVariableMatcher).toHaveBeenCalledWith(
        expect.objectContaining({
          comment: "mock approval comment",
          wholeProgram: true,
        })
      );
    });
  });

  it("should gracefully handle API GraphQL errors", async () => {
    const appId = "556ac14a-f247-42e8-8878-8468060fb49a";
    const mock: MockedResponse<ApproveAppResp, ApproveAppInput> = {
      request: {
        query: APPROVE_APP,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("Test GraphQL error")],
      },
    };

    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => (
        <TestParent mocks={[getAppMock, mock]} appId={appId}>
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(FormStatus.LOADED);
    });

    await act(async () => {
      const approveResp = await result.current.approveForm(
        { reviewComment: "", pendingModelChange: false },
        true
      );
      expect(approveResp).toEqual({
        status: "failed",
        errorMessage: "Test GraphQL error",
      });
    });
  });

  it("should gracefully handle API network errors", async () => {
    const appId = "556ac14a-f247-42e8-8878-8468060fb49a";
    const mock: MockedResponse<ApproveAppResp, ApproveAppInput> = {
      request: {
        query: APPROVE_APP,
      },
      variableMatcher: () => true,
      error: new Error("Test network error"),
    };

    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => (
        <TestParent mocks={[getAppMock, mock]} appId={appId}>
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(FormStatus.LOADED);
    });

    await act(async () => {
      const approveResp = await result.current.approveForm(
        { reviewComment: "", pendingModelChange: false },
        true
      );
      expect(approveResp).toEqual({
        status: "failed",
        errorMessage: "Test network error",
      });
    });
  });
});

describe("inquireForm Tests", () => {
  const getAppMock: MockedResponse<GetAppResp> = {
    request: {
      query: GET_APP,
    },
    variableMatcher: () => true,
    result: {
      data: {
        getApplication: {
          ...baseApplication,
          questionnaireData: JSON.stringify(
            questionnaireDataFactory.build({
              sections: [{ name: "A", status: "In Progress" }], // To prevent fetching lastApp
            })
          ),
        },
      },
    },
  };

  it("should send an inquire request to the API", async () => {
    const mockVariableMatcher = vi.fn().mockImplementation(() => true);
    const mock: MockedResponse<InquireAppResp> = {
      request: {
        query: INQUIRE_APP,
      },
      variableMatcher: mockVariableMatcher,
      result: {
        data: {
          inquireApplication: {
            _id: "mock-inquire-id",
          },
        },
      },
    };

    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => (
        <TestParent mocks={[getAppMock, mock]} appId="mock-inquire-id">
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(FormStatus.LOADED);
    });

    await act(async () => {
      const inquireResp = await result.current.inquireForm("mock comment here");
      expect(inquireResp).toEqual("mock-inquire-id");
      expect(mockVariableMatcher).toHaveBeenCalledWith(
        expect.objectContaining({
          comment: "mock comment here",
        })
      );
    });
  });

  it("should gracefully handle API GraphQL errors", async () => {
    const mock: MockedResponse<InquireAppResp> = {
      request: {
        query: INQUIRE_APP,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("Test Inquire GraphQL error")],
      },
    };

    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => (
        <TestParent mocks={[getAppMock, mock]} appId="mock-app-id">
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(FormStatus.LOADED);
    });

    await act(async () => {
      const inquireResp = await result.current.inquireForm("");
      expect(inquireResp).toEqual(false);
    });
  });

  it("should gracefully handle API network errors", async () => {
    const mock: MockedResponse<InquireAppResp> = {
      request: {
        query: INQUIRE_APP,
      },
      variableMatcher: () => true,
      error: new Error("Test Inquire network error"),
    };

    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => (
        <TestParent mocks={[getAppMock, mock]} appId="mock-app-id">
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(FormStatus.LOADED);
    });

    await act(async () => {
      const approveResp = await result.current.inquireForm("");
      expect(approveResp).toEqual(false);
    });
  });
});

describe("rejectForm Tests", () => {
  const getAppMock: MockedResponse<GetAppResp> = {
    request: {
      query: GET_APP,
    },
    variableMatcher: () => true,
    result: {
      data: {
        getApplication: {
          ...baseApplication,
          questionnaireData: JSON.stringify(
            questionnaireDataFactory.build({
              sections: [{ name: "A", status: "In Progress" }], // To prevent fetching lastApp
            })
          ),
        },
      },
    },
  };

  it("should send an reject request to the API", async () => {
    const mockVariableMatcher = vi.fn().mockImplementation(() => true);
    const mock: MockedResponse<RejectAppResp> = {
      request: {
        query: REJECT_APP,
      },
      variableMatcher: mockVariableMatcher,
      result: {
        data: {
          rejectApplication: {
            _id: "mock-reject-id",
          },
        },
      },
    };

    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => (
        <TestParent mocks={[getAppMock, mock]} appId="mock-reject-id">
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(FormStatus.LOADED);
    });

    await act(async () => {
      const rejectResp = await result.current.rejectForm("mock reject comment");
      expect(rejectResp).toEqual("mock-reject-id");
      expect(mockVariableMatcher).toHaveBeenCalledWith(
        expect.objectContaining({
          comment: "mock reject comment",
        })
      );
    });
  });

  it("should gracefully handle API GraphQL errors", async () => {
    const mock: MockedResponse<RejectAppResp> = {
      request: {
        query: REJECT_APP,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("Test Reject GraphQL error")],
      },
    };

    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => (
        <TestParent mocks={[getAppMock, mock]} appId="mock-app-id">
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(FormStatus.LOADED);
    });

    await act(async () => {
      const rejectResp = await result.current.rejectForm("");
      expect(rejectResp).toEqual(false);
    });
  });

  it("should gracefully handle API network errors", async () => {
    const mock: MockedResponse<RejectAppResp> = {
      request: {
        query: REJECT_APP,
      },
      variableMatcher: () => true,
      error: new Error("Test Reject network error"),
    };

    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => (
        <TestParent mocks={[getAppMock, mock]} appId="mock-app-id">
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(FormStatus.LOADED);
    });

    await act(async () => {
      const rejectResp = await result.current.rejectForm("");
      expect(rejectResp).toEqual(false);
    });
  });
});

describe("reopenForm Tests", () => {
  const getAppMock: MockedResponse<GetAppResp> = {
    request: {
      query: GET_APP,
    },
    variableMatcher: () => true,
    result: {
      data: {
        getApplication: {
          ...baseApplication,
          questionnaireData: JSON.stringify(
            questionnaireDataFactory.build({
              sections: [{ name: "A", status: "In Progress" }], // To prevent fetching lastApp
            })
          ),
        },
      },
    },
  };

  it("should send a reopen request to the API", async () => {
    const mockVariableMatcher = vi.fn().mockImplementation(() => true);
    const mock: MockedResponse<ReopenAppResp> = {
      request: {
        query: REOPEN_APP,
      },
      variableMatcher: mockVariableMatcher,
      result: {
        data: {
          reopenApplication: {
            _id: "mock-reopen-id",
            status: "In Progress",
          } as ReopenAppResp["reopenApplication"],
        },
      },
    };

    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => (
        <TestParent mocks={[getAppMock, mock]} appId="mock-reopen-id">
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(FormStatus.LOADED);
    });

    await act(async () => {
      const reviewResp = await result.current.reopenForm();
      expect(reviewResp).toEqual("mock-reopen-id");
      expect(mockVariableMatcher).toHaveBeenCalled();
    });
  });

  it("should gracefully handle API GraphQL errors", async () => {
    const mock: MockedResponse<ReopenAppResp> = {
      request: {
        query: REOPEN_APP,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("Test Reopen GraphQL error")],
      },
    };

    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => (
        <TestParent mocks={[getAppMock, mock]} appId="mock-app-id">
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(FormStatus.LOADED);
    });

    await act(async () => {
      const reviewResp = await result.current.reopenForm();
      expect(reviewResp).toEqual(false);
    });
  });

  it("should gracefully handle API network errors", async () => {
    const mock: MockedResponse<ReopenAppResp> = {
      request: {
        query: REOPEN_APP,
      },
      variableMatcher: () => true,
      error: new Error("Test Reopen network error"),
    };

    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => (
        <TestParent mocks={[getAppMock, mock]} appId="mock-app-id">
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(FormStatus.LOADED);
    });

    await act(async () => {
      const reviewResp = await result.current.reopenForm();
      expect(reviewResp).toEqual(false);
    });
  });
});

describe("saveApp Tests", () => {
  it("should propagate top level attributes from saveApplication response", async () => {
    const appId = "556ac14a-f247-42e8-8878-8468060fb49a";

    const mockGetApp: MockedResponse<GetAppResp, GetAppInput> = {
      request: {
        query: GET_APP,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getApplication: {
            ...applicationFactory.build({
              _id: appId,
              programName: "original program name",
              studyAbbreviation: "original study abbreviation",
              status: "In Progress",
            }),
            questionnaireData: JSON.stringify(
              questionnaireDataFactory.build({
                sections: [{ name: "A", status: "In Progress" }], // To prevent fetching lastApp
              })
            ),
          },
        },
      },
    };

    const mockSave: MockedResponse<SaveAppResp, SaveAppInput> = {
      request: {
        query: SAVE_APP,
      },
      variableMatcher: () => true,
      result: {
        data: {
          saveApplication: applicationFactory.build({
            _id: appId,
            programName: "updated program name",
            studyAbbreviation: "updated study abbreviation",
            status: "New",
          }),
        },
      },
    };

    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => (
        <TestParent mocks={[mockGetApp, mockSave]} appId={appId}>
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(FormStatus.LOADED);
    });

    await act(async () => {
      const saveResp = await result.current.setData(questionnaireDataFactory.build());
      expect(saveResp.status).toEqual("success");
    });

    expect(result.current.data?.programName).toEqual("updated program name");
    expect(result.current.data?.studyAbbreviation).toEqual("updated study abbreviation");
    expect(result.current.data?.status).toEqual("New");
  });

  it("should propagate API errors from the saveApplication response", async () => {
    const appId = "556ac14a-f247-42e8-8878-8468060fb49a";

    const mockGetApp: MockedResponse<GetAppResp, GetAppInput> = {
      request: {
        query: GET_APP,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getApplication: {
            ...applicationFactory.build({
              _id: appId,
            }),
            questionnaireData: JSON.stringify(
              questionnaireDataFactory.build({
                sections: [{ name: "A", status: "In Progress" }], // To prevent fetching lastApp
              })
            ),
          },
        },
      },
    };

    const mockSave: MockedResponse<SaveAppResp, SaveAppInput> = {
      request: {
        query: SAVE_APP,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("Test SaveApplication GraphQL error")],
      },
    };

    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => (
        <TestParent mocks={[mockGetApp, mockSave]} appId={appId}>
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(FormStatus.LOADED);
    });

    await act(async () => {
      const saveResp = await result.current.setData(questionnaireDataFactory.build());
      expect(saveResp.status).toEqual("failed");
    });

    expect(result.current.status).toEqual(FormStatus.ERROR);
    expect(result.current.error).toEqual("Test SaveApplication GraphQL error");
  });

  it("should skip the API call if opts.skipSave is set", async () => {
    const appId = "556ac14a-f247-42e8-8878-8468060fb49a";

    const mockGetApp: MockedResponse<GetAppResp, GetAppInput> = {
      request: {
        query: GET_APP,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getApplication: {
            ...applicationFactory.build({
              _id: appId,
            }),
            questionnaireData: JSON.stringify(
              questionnaireDataFactory.build({
                sections: [{ name: "A", status: "In Progress" }], // To prevent fetching lastApp
              })
            ),
          },
        },
      },
    };

    const mockMatcher = vi.fn().mockImplementation(() => true);
    const mockSave: MockedResponse<SaveAppResp, SaveAppInput> = {
      request: {
        query: SAVE_APP,
      },
      variableMatcher: mockMatcher,
      result: {
        errors: [new GraphQLError("This api should not be called")],
      },
    };

    const { result } = renderHook(() => useFormContext(), {
      wrapper: ({ children }) => (
        <TestParent mocks={[mockGetApp, mockSave]} appId={appId}>
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(FormStatus.LOADED);
    });

    await act(async () => {
      const saveResp = await result.current.setData(questionnaireDataFactory.build(), {
        skipSave: true,
      });
      expect(saveResp.status).toEqual("success");
    });

    expect(mockMatcher).not.toHaveBeenCalled();
  });
});
