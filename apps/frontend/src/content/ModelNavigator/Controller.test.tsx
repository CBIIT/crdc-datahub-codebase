import { FC, useEffect } from "react";
import { Route, RouterProvider, Routes, createMemoryRouter } from "react-router-dom";

import { TestRouter, act, render, waitFor } from "../../test-utils";

import Controller from "./Controller";

const mockUsePageTitle = vi.fn();
const mockNavigatorMount = vi.fn();
vi.mock("../../hooks/usePageTitle", () => ({
  ...vi.importActual("../../hooks/usePageTitle"),
  __esModule: true,
  default: (p: string) => mockUsePageTitle(p),
}));

vi.mock("./NavigatorView", () => ({
  __esModule: true,
  default: ({ model, version }: { model: string; version?: string }) => {
    useEffect(() => {
      mockNavigatorMount(model, version);
    }, []);

    return (
      <div>
        MOCK NAVIGATOR VIEW {model} {version}
      </div>
    );
  },
}));

type ParentProps = {
  initialEntry?: string;
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({ initialEntry = "/", children }: ParentProps) => (
  <TestRouter initialEntries={[initialEntry]}>
    <Routes>
      <Route path="/model-navigator/:model/:version?" element={children} />
      <Route path="/" element={<div>MOCK HOME PAGE</div>} />
    </Routes>
  </TestRouter>
);

describe("Basic Functionality", () => {
  it("should set the page title", async () => {
    render(<Controller />, {
      wrapper: ({ children }) => (
        <TestParent initialEntry="/model-navigator/fake-model/1.0.0">{children}</TestParent>
      ),
    });

    await waitFor(() => {
      expect(mockUsePageTitle).toHaveBeenCalledWith("Model Navigator");
    });
  });

  it("should render the page without crashing", async () => {
    expect(() =>
      render(<Controller />, {
        wrapper: ({ children }) => (
          <TestParent initialEntry="/model-navigator/fake-model/1.0.0">{children}</TestParent>
        ),
      })
    ).not.toThrow();
  });

  it("should redirect to the latest version if no version is provided", async () => {
    const history = createMemoryRouter(
      [
        {
          path: "/model-navigator/:model/:version?",
          element: <Controller />,
        },
      ],
      {
        initialEntries: ["/model-navigator/fake-model"],
        future: {
          v7_relativeSplatPath: true,
        },
      }
    );

    expect(history.state.location.pathname).toBe("/model-navigator/fake-model"); // Assert the "user" is at the starting location

    render(<RouterProvider router={history} future={{ v7_startTransition: true }} />); // Render the router, and subsequently, the Controller with redirect

    await waitFor(() => {
      expect(history.state.location.pathname).toBe("/model-navigator/fake-model/latest"); // Assert the "user" is redirected to the latest version
    });
  });

  it.each<string>(["3.2.0", "latest"])(
    "should pass the model and version '%s' to the NavigatorView",
    async (version) => {
      render(<Controller />, {
        wrapper: ({ children }) => (
          <TestParent initialEntry={`/model-navigator/fake-model/${version}`}>
            {children}
          </TestParent>
        ),
      });

      await waitFor(() => {
        expect(document.body).toHaveTextContent(`MOCK NAVIGATOR VIEW fake-model ${version}`);
      });
    }
  );

  // NOTE: This is preventing a regression where model navigator fails to show the correct
  // model and version when navigating between different routes via the navigation bar
  it("should remount the navigator when the model or version changes", async () => {
    const router = createMemoryRouter(
      [{ path: "/model-navigator/:model/:version?", element: <Controller /> }],
      {
        initialEntries: ["/model-navigator/GC/1.0.0"],
        future: { v7_relativeSplatPath: true },
      }
    );

    render(<RouterProvider router={router} future={{ v7_startTransition: true }} />);
    await waitFor(() => expect(mockNavigatorMount).toHaveBeenLastCalledWith("GC", "1.0.0"));

    await act(async () => {
      await router.navigate("/model-navigator/GC/2.0.0");
    });
    await waitFor(() => expect(mockNavigatorMount).toHaveBeenLastCalledWith("GC", "2.0.0"));

    await act(async () => {
      await router.navigate("/model-navigator/ICDC/2.0.0");
    });
    await waitFor(() => expect(mockNavigatorMount).toHaveBeenLastCalledWith("ICDC", "2.0.0"));
  });
});
