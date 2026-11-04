import { MockedProvider } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { FC, useMemo } from "react";
import { BrowserRouter } from "react-router-dom";
import { axe } from "vitest-axe";

import { ContextState, Context, Status } from "@/components/Contexts/AuthContext";
import { DataModelsContext, DataModelsCtxState } from "@/components/Contexts/DataModelsContext";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { dataCommonFactory } from "@/factories/data-common/DataCommonFactory";
import { dataModelsCtxStateFactory } from "@/factories/data-common/DataModelsCtxStateFactory";
import { render, waitFor, within } from "@/test-utils";

import Header from "./index";

const mockUseMediaQuery = vi.fn();
vi.mock("@mui/material", async () => ({
  ...(await vi.importActual("@mui/material")),
  useMediaQuery: (query: string) => mockUseMediaQuery(query),
}));

const defaultModels: DataCommon[] = [
  dataCommonFactory.build({ name: "CDS", displayName: "GC" }),
  dataCommonFactory.build({ name: "ICDC", displayName: "ICDC" }),
  dataCommonFactory.build({ name: "HIDDEN", displayName: "Secret", isHidden: true }),
];

const Parent: FC<{
  children: React.ReactElement;
  loggedIn?: boolean;
  error?: string;
  dataModels?: DataModelsCtxState;
}> = ({
  children,
  loggedIn = false,
  error = null,
  dataModels = dataModelsCtxStateFactory.build({ models: defaultModels }),
}) => {
  const value: ContextState = useMemo(
    () =>
      authCtxStateFactory.build({
        isLoggedIn: loggedIn,
        status: error ? Status.ERROR : Status.LOADED,
        user: null,
        error,
      }),
    [loggedIn, error]
  );

  return (
    <MockedProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Context.Provider value={value}>
          <DataModelsContext.Provider value={dataModels}>{children}</DataModelsContext.Provider>
        </Context.Provider>
      </BrowserRouter>
    </MockedProvider>
  );
};

describe("Accessibility", () => {
  it("should not have accessibility violations (Logged In)", async () => {
    const { container } = render(<Header />, { wrapper: (p) => <Parent loggedIn {...p} /> });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should not have accessibility violations (Logged Out)", async () => {
    const { container } = render(<Header />, {
      wrapper: (p) => <Parent loggedIn={false} {...p} />,
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Implementation Requirements", () => {
  it("should show the desktop header when the screen is larger than 1024px", () => {
    mockUseMediaQuery.mockReturnValue(false);

    const { getByTestId } = render(<Header />, {
      wrapper: (p) => <Parent {...p} />,
    });

    expect(getByTestId("navigation-header-desktop")).toBeInTheDocument();
  });

  it("should show the tablet and mobile header when the screen is 1024px or smaller", () => {
    mockUseMediaQuery.mockReturnValue(true);

    const { getByTestId } = render(<Header />, {
      wrapper: (p) => <Parent {...p} />,
    });

    expect(getByTestId("navigation-header-mobile")).toBeInTheDocument();
  });

  it("should always show the USA banner", () => {
    const { getByTestId } = render(<Header />, {
      wrapper: (p) => <Parent {...p} />,
    });

    expect(getByTestId("navigation-flag-banner")).toBeInTheDocument();
  });

  it("should show an error snackbar when there is an authentication error", async () => {
    render(<Header />, {
      wrapper: (p) => <Parent error="mock auth error" {...p} />,
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("mock auth error", {
        variant: "error",
      });
    });
  });

  it("should show an error snackbar when there is an unknown error type", async () => {
    render(<Header />, {
      wrapper: (p) => (
        <Parent error={["Some unknown representation of an error"] as unknown as string} {...p} />
      ),
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("An unknown error occurred during login", {
        variant: "error",
      });
    });
  });

  it("should list only the visible Data Models in the desktop dropdown", async () => {
    mockUseMediaQuery.mockReturnValue(false);

    const { getByText, findByText, queryByText } = render(<Header />, {
      wrapper: (p) => <Parent {...p} />,
    });

    userEvent.click(getByText("Model Navigator"));

    expect(await findByText("GC Model")).toHaveAttribute("href", "/model-navigator/GC/latest");
    expect(getByText("ICDC Model")).toHaveAttribute("href", "/model-navigator/ICDC/latest");
    expect(queryByText(/Secret/)).not.toBeInTheDocument();
  });

  it("should list data models in the exact order provided", async () => {
    mockUseMediaQuery.mockReturnValue(false);

    const { getByText, findByText, container } = render(<Header />, {
      wrapper: (p) => <Parent {...p} />,
    });

    userEvent.click(getByText("Model Navigator"));
    await findByText("GC Model");

    const ids = Array.from(container.querySelectorAll("a[id^='model-navigator-']")).map(
      (a) => a.id
    );
    expect(ids).toEqual(["model-navigator-CDS", "model-navigator-ICDC"]);
  });

  it("should still show the Model Navigator item when no Data Models are available", () => {
    mockUseMediaQuery.mockReturnValue(false);

    const { getByText, container } = render(<Header />, {
      wrapper: (p) => (
        <Parent dataModels={dataModelsCtxStateFactory.build({ models: [] })} {...p} />
      ),
    });

    expect(getByText("Model Navigator")).toBeInTheDocument();

    userEvent.click(getByText("Model Navigator"));

    expect(container.querySelectorAll("a[id^='model-navigator-']")).toHaveLength(0);
  });

  it("should list only the visible data models in the mobile menu and return to the main menu", async () => {
    mockUseMediaQuery.mockReturnValue(true);

    const { getByTestId } = render(<Header />, {
      wrapper: (p) => <Parent {...p} />,
    });

    const mobileMenu = within(document.body);
    expect(mobileMenu.queryByText("Main Menu")).not.toBeInTheDocument();

    userEvent.click(mobileMenu.getByText("Model Navigator"));

    expect(await mobileMenu.findByText("GC Model")).toBeInTheDocument();
    expect(mobileMenu.getByText("ICDC Model")).toBeInTheDocument();
    expect(mobileMenu.queryByText(/Secret/)).not.toBeInTheDocument();
    expect(mobileMenu.getByText("Main Menu")).toBeInTheDocument();

    userEvent.click(mobileMenu.getByText("Main Menu"));

    await waitFor(() => {
      expect(mobileMenu.queryByText("Main Menu")).not.toBeInTheDocument();
    });
    expect(mobileMenu.getByText("Model Navigator")).toBeInTheDocument();
    expect(getByTestId("navigation-header-mobile")).toBeInTheDocument();
  });
});
