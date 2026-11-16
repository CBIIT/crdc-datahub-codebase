import { renderHook } from "@testing-library/react";
import { FC } from "react";

import { DataModelsContext, DataModelsCtxState } from "@/components/Contexts/DataModelsContext";
import { HeaderLinks, MODEL_NAVIGATOR_NAV_ID } from "@/config/HeaderConfig";
import { dataCommonFactory } from "@/factories/data-common/DataCommonFactory";
import { dataModelsCtxStateFactory } from "@/factories/data-common/DataModelsCtxStateFactory";

import useHeaderLinks from "./useHeaderLinks";

type MockParentProps = {
  value: DataModelsCtxState;
  children: React.ReactNode;
};

const MockParent: FC<MockParentProps> = ({ value, children }) => (
  <DataModelsContext.Provider value={value}>{children}</DataModelsContext.Provider>
);

describe("Basic Functionality", () => {
  it("should return every header link in the configured order", () => {
    const { result } = renderHook(() => useHeaderLinks(), {
      wrapper: ({ children }) => (
        <MockParent value={dataModelsCtxStateFactory.build()}>{children}</MockParent>
      ),
    });

    expect(result.current.map((link) => link.id)).toEqual(HeaderLinks.map((link) => link.id));
  });

  it("should not modify the static header links", () => {
    const { result } = renderHook(() => useHeaderLinks(), {
      wrapper: ({ children }) => (
        <MockParent
          value={dataModelsCtxStateFactory.build({
            models: [dataCommonFactory.build({ name: "CDS", displayName: "GC" })],
          })}
        >
          {children}
        </MockParent>
      ),
    });

    result.current.forEach((link, index) => {
      if (link.id !== MODEL_NAVIGATOR_NAV_ID) {
        expect(link).toBe(HeaderLinks[index]);
      }
    });
    expect(HeaderLinks.find((link) => link.id === MODEL_NAVIGATOR_NAV_ID).columns).toEqual([]);
  });

  it("should return no Model Navigator columns when no Data Models are visible", () => {
    const { result } = renderHook(() => useHeaderLinks(), {
      wrapper: ({ children }) => (
        <MockParent value={dataModelsCtxStateFactory.build({ models: [] })}>{children}</MockParent>
      ),
    });

    const modelNavigator = result.current.find((link) => link.id === MODEL_NAVIGATOR_NAV_ID);

    expect(modelNavigator).toBeDefined();
    expect(modelNavigator.columns).toEqual([]);
  });

  it("should return the same reference when re-rendered with the same visible Data Models", () => {
    const value = dataModelsCtxStateFactory.build({
      models: [dataCommonFactory.build({ name: "CDS", displayName: "GC" })],
    });

    const { result, rerender } = renderHook(() => useHeaderLinks(), {
      wrapper: ({ children }) => <MockParent value={value}>{children}</MockParent>,
    });

    const initialLinks = result.current;

    rerender();

    expect(result.current).toBe(initialLinks);
  });

  it("should return a new reference when the visible Data Models change", () => {
    let value = dataModelsCtxStateFactory.build({ models: [] });

    const { result, rerender } = renderHook(() => useHeaderLinks(), {
      wrapper: ({ children }) => <MockParent value={value}>{children}</MockParent>,
    });

    const initialLinks = result.current;

    value = dataModelsCtxStateFactory.build({
      models: [dataCommonFactory.build({ name: "CDS", displayName: "GC" })],
    });
    rerender();

    expect(result.current).not.toBe(initialLinks);
    expect(
      result.current.find((link) => link.id === MODEL_NAVIGATOR_NAV_ID).columns.flat()
    ).toEqual([expect.objectContaining({ id: "model-navigator-CDS" })]);
  });
});

describe("Implementation Requirements", () => {
  it("should build one Model Navigator column per visible Data Model, in order", () => {
    const { result } = renderHook(() => useHeaderLinks(), {
      wrapper: ({ children }) => (
        <MockParent
          value={dataModelsCtxStateFactory.build({
            models: [
              dataCommonFactory.build({ name: "CDS", displayName: "GC" }),
              dataCommonFactory.build({ name: "HIDDEN", displayName: "Secret", isHidden: true }),
              dataCommonFactory.build({ name: "ICDC", displayName: "ICDC" }),
            ],
          })}
        >
          {children}
        </MockParent>
      ),
    });

    const modelNavigator = result.current.find((link) => link.id === MODEL_NAVIGATOR_NAV_ID);

    expect(modelNavigator.columns).toEqual([
      [
        {
          id: "model-navigator-CDS",
          name: "GC Model",
          link: "/model-navigator/GC/latest",
          className: "navMobileSubItem",
        },
      ],
      [
        {
          id: "model-navigator-ICDC",
          name: "ICDC Model",
          link: "/model-navigator/ICDC/latest",
          className: "navMobileSubItem",
        },
      ],
    ]);
  });

  it("should not append 'Model' when the display name already contains it", () => {
    const { result } = renderHook(() => useHeaderLinks(), {
      wrapper: ({ children }) => (
        <MockParent
          value={dataModelsCtxStateFactory.build({
            models: [dataCommonFactory.build({ name: "PDC", displayName: "PDC_Model" })],
          })}
        >
          {children}
        </MockParent>
      ),
    });

    const modelNavigator = result.current.find((link) => link.id === MODEL_NAVIGATOR_NAV_ID);

    expect(modelNavigator.columns).toEqual([
      [expect.objectContaining({ name: "PDC_Model", link: "/model-navigator/PDC_Model/latest" })],
    ]);
  });
});
