import { FC } from "react";
import { MemoryRouterProps } from "react-router-dom";
import { axe } from "vitest-axe";

import { TestRouter, render } from "../../test-utils";

import FormAlert from ".";

type TestParentProps = {
  initialEntries: MemoryRouterProps["initialEntries"];
  children: React.ReactNode;
};

const TestParent: FC<TestParentProps> = ({ initialEntries, children }) => (
  <TestRouter initialEntries={initialEntries}>{children}</TestRouter>
);

describe("Accessibility", () => {
  it("should not have any accessibility violations", async () => {
    const { container, getByText } = render(<FormAlert error="some mock error message" />, {
      wrapper: ({ children }) => <TestParent initialEntries={["/"]}>{children}</TestParent>,
    });

    expect(getByText("some mock error message")).toBeInTheDocument(); // Sanity check
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    expect(() => {
      render(<FormAlert />, {
        wrapper: ({ children }) => <TestParent initialEntries={["/"]}>{children}</TestParent>,
      });
    }).not.toThrow();
  });

  it("should render an alert with a provided error message (prop)", () => {
    const { getByText } = render(<FormAlert error="Test error message" />, {
      wrapper: ({ children }) => <TestParent initialEntries={["/"]}>{children}</TestParent>,
    });

    expect(getByText("Test error message")).toBeInTheDocument();
  });

  it("should render an alert with a provided error message (state)", () => {
    const { getByText } = render(<FormAlert />, {
      wrapper: ({ children }) => (
        <TestParent
          initialEntries={[
            {
              pathname: "/",
              state: { alert: true, error: "an error in the state" },
            },
          ]}
        >
          {children}
        </TestParent>
      ),
    });

    expect(getByText("an error in the state")).toBeInTheDocument();
  });

  it.each([false, undefined])(
    "should not render an alert if the `state.alert` is %s",
    (alertState) => {
      const { queryByText } = render(<FormAlert />, {
        wrapper: ({ children }) => (
          <TestParent
            initialEntries={[
              {
                pathname: "/",
                state: { alert: alertState, error: "some error msg" },
              },
            ]}
          >
            {children}
          </TestParent>
        ),
      });

      expect(queryByText("some error msg")).not.toBeInTheDocument();
    }
  );
});
