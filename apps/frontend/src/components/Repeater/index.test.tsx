import { render } from "../../test-utils";

import Repeater from "./index";

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    expect(() =>
      render(
        <Repeater count={1} keyPrefix="test">
          <p>some child</p>
        </Repeater>
      )
    ).not.toThrow();
  });

  it("should render the correct number of children", () => {
    const { getAllByTestId } = render(
      <Repeater count={3}>
        <p data-testid="repeated-child">some child</p>
      </Repeater>
    );

    expect(getAllByTestId("repeated-child")).toHaveLength(3);
  });

  it("should handle a large number of children", () => {
    const { getAllByTestId } = render(
      <Repeater count={1000}>
        <p data-testid="repeated-child">some child</p>
      </Repeater>
    );

    expect(getAllByTestId("repeated-child")).toHaveLength(1000);
  });

  it("should handle zero children", () => {
    const { container } = render(
      <Repeater count={0}>
        <span>a child</span>
      </Repeater>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("should handle a custom react element", () => {
    const Child = () => <div>a very cool component</div>;

    const { getAllByText } = render(
      <Repeater count={3}>
        <Child />
      </Repeater>
    );

    expect(getAllByText("a very cool component")).toHaveLength(3);
  });

  it("should rebuild children when count changes", () => {
    const { rerender, getAllByTestId } = render(
      <Repeater count={3}>
        <p data-testid="repeated-child">some child</p>
      </Repeater>
    );

    expect(getAllByTestId("repeated-child")).toHaveLength(3);

    rerender(
      <Repeater count={5}>
        <p data-testid="repeated-child">some child</p>
      </Repeater>
    );

    expect(getAllByTestId("repeated-child")).toHaveLength(5);
  });
});
