import { Routes, Route } from "react-router-dom";

import { TestRouter, render, waitFor } from "../../test-utils";

import RequireAuth from "./index";

const mockUseAuthContext = vi.fn();
vi.mock("../Contexts/AuthContext", async () => ({
  ...(await vi.importActual("../Contexts/AuthContext")),
  useAuthContext: () => mockUseAuthContext(),
}));

const TestRoutes: React.ReactElement = (
  <TestRouter initialEntries={["/protected"]}>
    <Routes>
      <Route
        path="/protected"
        element={
          <RequireAuth
            component={<p>Protected Page</p>}
            redirectPath="/test"
            redirectName="Protected Page"
          />
        }
      />
      <Route path="/" element={<div>Login Page</div>} />
    </Routes>
  </TestRouter>
);

describe("Basic Functionality", () => {
  it("should render the protected page when the user is logged in", () => {
    mockUseAuthContext.mockReturnValueOnce({ isLoggedIn: true });

    const { getByText } = render(TestRoutes);

    expect(getByText("Protected Page")).toBeInTheDocument();
  });

  it("should redirect the user home if the user is not logged in", async () => {
    mockUseAuthContext.mockReturnValueOnce({ isLoggedIn: false });

    const { getByText } = render(TestRoutes);

    await waitFor(() => {
      expect(getByText("Login Page")).toBeInTheDocument();
    });
  });
});
