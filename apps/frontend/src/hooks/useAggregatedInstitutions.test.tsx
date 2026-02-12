import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { renderHook, waitFor } from "@testing-library/react";
import { FC, useMemo } from "react";

import {
  Context as FormContext,
  ContextState as FormContextState,
  Status as FormStatus,
} from "@/components/Contexts/FormContext";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { formContextStateFactory } from "@/factories/application/FormContextStateFactory";
import { institutionFactory } from "@/factories/institution/InstitutionFactory";
import { LIST_INSTITUTIONS, ListInstitutionsInput, ListInstitutionsResp } from "@/graphql";

import useAggregatedInstitutions from "./useAggregatedInstitutions";

type MockParentProps = {
  application: Application;
  mock: MockedResponse<ListInstitutionsResp, ListInstitutionsInput>;
  children: React.ReactNode;
};

const MockParent: FC<MockParentProps> = ({ application, mock, children }) => {
  const formCtxState = useMemo<FormContextState>(
    () => ({
      ...formContextStateFactory.build({ status: FormStatus.LOADED, data: application }),
    }),
    [application]
  );

  return (
    <MockedProvider mocks={[mock]} addTypename={false}>
      <FormContext.Provider value={formCtxState}>{children}</FormContext.Provider>
    </MockedProvider>
  );
};

describe("useAggregatedInstitutions", () => {
  it("should aggregate institutions from both app data and API data", async () => {
    const mock: MockedResponse<ListInstitutionsResp, ListInstitutionsInput> = {
      request: {
        query: LIST_INSTITUTIONS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listInstitutions: {
            total: 1,
            institutions: [
              institutionFactory.build({ _id: "mock-uuid-1", name: "API Institution 1" }),
            ],
          },
        },
      },
    };

    const mockApp = applicationFactory.build({
      newInstitutions: [
        { id: "mock-uuid-2", name: "App Institution 1" },
        { id: "mock-uuid-3", name: "App Institution 2" },
      ],
    });

    const { result } = renderHook(() => useAggregatedInstitutions(), {
      wrapper: ({ children }) => (
        <MockParent application={mockApp} mock={mock}>
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.data.length).toBe(3);
    });

    expect(result.current.data).toEqual(
      expect.arrayContaining([
        { _id: "mock-uuid-1", name: "API Institution 1" },
        { _id: "mock-uuid-2", name: "App Institution 1" },
        { _id: "mock-uuid-3", name: "App Institution 2" },
      ])
    );
  });

  it("should handle empty institution lists gracefully", async () => {
    const mock: MockedResponse<ListInstitutionsResp, ListInstitutionsInput> = {
      request: {
        query: LIST_INSTITUTIONS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listInstitutions: {
            total: 0,
            institutions: [],
          },
        },
      },
    };

    const mockApp = applicationFactory.build({
      newInstitutions: [],
    });

    const { result } = renderHook(() => useAggregatedInstitutions(), {
      wrapper: ({ children }) => (
        <MockParent application={mockApp} mock={mock}>
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.data.length).toBe(0);
    });

    expect(result.current.data).toEqual([]);
  });

  it("should sort institutions by name in ascending order", async () => {
    const mock: MockedResponse<ListInstitutionsResp, ListInstitutionsInput> = {
      request: {
        query: LIST_INSTITUTIONS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listInstitutions: {
            total: 2,
            institutions: [
              institutionFactory.build({ _id: "mock-uuid-1", name: "ABC" }),
              institutionFactory.build({ _id: "mock-uuid-2", name: "DEF" }),
            ],
          },
        },
      },
    };

    const mockApp = applicationFactory.build({
      newInstitutions: [
        { id: "mock-uuid-3", name: "AAA" },
        { id: "mock-uuid-4", name: "BBB" },
      ],
    });

    const { result } = renderHook(() => useAggregatedInstitutions(), {
      wrapper: ({ children }) => (
        <MockParent application={mockApp} mock={mock}>
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.data.length).toBe(4);
    });

    expect(result.current.data).toEqual([
      { _id: "mock-uuid-3", name: "AAA" },
      { _id: "mock-uuid-1", name: "ABC" },
      { _id: "mock-uuid-4", name: "BBB" },
      { _id: "mock-uuid-2", name: "DEF" },
    ]);
  });

  it("should sort institutions by name ignoring case", async () => {
    const mock: MockedResponse<ListInstitutionsResp, ListInstitutionsInput> = {
      request: {
        query: LIST_INSTITUTIONS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listInstitutions: {
            total: 2,
            institutions: [
              institutionFactory.build({ _id: "mock-uuid-1", name: "ABC" }),
              institutionFactory.build({ _id: "mock-uuid-2", name: "DEF" }),
            ],
          },
        },
      },
    };

    const mockApp = applicationFactory.build({
      newInstitutions: [
        { id: "mock-uuid-3", name: "abc" },
        { id: "mock-uuid-4", name: "def" },
      ],
    });

    const { result } = renderHook(() => useAggregatedInstitutions(), {
      wrapper: ({ children }) => (
        <MockParent application={mockApp} mock={mock}>
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.data.length).toBe(4);
    });

    expect(result.current.data).toEqual([
      { _id: "mock-uuid-1", name: "ABC" },
      { _id: "mock-uuid-3", name: "abc" },
      { _id: "mock-uuid-2", name: "DEF" },
      { _id: "mock-uuid-4", name: "def" },
    ]);
  });

  it("should filter out duplicate institutions by name, prioritizing API data", async () => {
    const mock: MockedResponse<ListInstitutionsResp, ListInstitutionsInput> = {
      request: {
        query: LIST_INSTITUTIONS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listInstitutions: {
            total: 2,
            institutions: [
              institutionFactory.build({ _id: "mock-uuid-1", name: "Duplicate Institution" }),
              institutionFactory.build({ _id: "mock-uuid-2", name: "Unique Institution" }),
            ],
          },
        },
      },
    };

    const mockApp = applicationFactory.build({
      newInstitutions: [
        { id: "mock-uuid-3", name: "Duplicate Institution" },
        { id: "mock-uuid-4", name: "Another Unique Institution" },
      ],
    });

    const { result } = renderHook(() => useAggregatedInstitutions(), {
      wrapper: ({ children }) => (
        <MockParent application={mockApp} mock={mock}>
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.data.length).toBe(3);
    });

    expect(result.current.data).toEqual(
      expect.arrayContaining([
        { _id: "mock-uuid-1", name: "Duplicate Institution" }, // Keep API
        { _id: "mock-uuid-2", name: "Unique Institution" }, // Keep API
        { _id: "mock-uuid-4", name: "Another Unique Institution" }, // Keep App
      ])
    );
  });

  it("should handle errors from the API gracefully", async () => {
    const mock: MockedResponse<ListInstitutionsResp, ListInstitutionsInput> = {
      request: {
        query: LIST_INSTITUTIONS,
      },
      variableMatcher: () => true,
      error: new Error("mock-api-error"),
    };

    const mockApp = applicationFactory.build({
      newInstitutions: [],
    });

    const { result } = renderHook(() => useAggregatedInstitutions(), {
      wrapper: ({ children }) => (
        <MockParent application={mockApp} mock={mock}>
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.data.length).toBe(0);
    });

    expect(result.current.data).toEqual([]);
  });

  it("should handle invalid application data gracefully", async () => {
    const mock: MockedResponse<ListInstitutionsResp, ListInstitutionsInput> = {
      request: {
        query: LIST_INSTITUTIONS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listInstitutions: {
            total: 0,
            institutions: [],
          },
        },
      },
    };

    const mockApp = applicationFactory.build({
      newInstitutions: null, // Simulating invalid data
    });

    const { result } = renderHook(() => useAggregatedInstitutions(), {
      wrapper: ({ children }) => (
        <MockParent application={mockApp} mock={mock}>
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.data.length).toBe(0);
    });

    expect(result.current.data).toEqual([]);
  });

  it("should handle invalid API response gracefully", async () => {
    const mock: MockedResponse<ListInstitutionsResp, ListInstitutionsInput> = {
      request: {
        query: LIST_INSTITUTIONS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listInstitutions: {
            total: 0,
            institutions: null,
          },
        },
      },
    };

    const mockApp = applicationFactory.build({
      newInstitutions: [],
    });

    const { result } = renderHook(() => useAggregatedInstitutions(), {
      wrapper: ({ children }) => (
        <MockParent application={mockApp} mock={mock}>
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(result.current.data.length).toBe(0);
    });

    expect(result.current.data).toEqual([]);
  });
});
