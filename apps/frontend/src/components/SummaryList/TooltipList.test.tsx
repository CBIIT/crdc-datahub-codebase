import { render } from "@testing-library/react";
import { axe } from "vitest-axe";

import TooltipList from "./TooltipList";

describe("Accessibility", () => {
  it("has no accessibility violations with items", async () => {
    const { container } = render(
      <TooltipList
        data={[
          { _id: "item-1", name: "Item One" },
          { _id: "item-2", name: "Item Two" },
        ]}
        getItemKey={(item) => item._id}
        renderTooltipItem={(item) => item.name}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with empty data", async () => {
    const { container } = render(
      <TooltipList
        data={[]}
        getItemKey={(item) => item._id}
        renderTooltipItem={(item) => item.name}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("TooltipList", () => {
  const data = [
    { _id: "item-1", name: "Item One" },
    { _id: "item-2", name: "Item Two" },
  ];

  it("renders nothing when data is undefined", () => {
    const { container } = render(<TooltipList data={undefined} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when data is null", () => {
    const { container } = render(<TooltipList data={null} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when data is an empty array", () => {
    const { container } = render(<TooltipList data={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders a list with one item", () => {
    const { getByTestId } = render(
      <TooltipList
        data={[data[0]]}
        getItemKey={(item) => item._id}
        renderTooltipItem={(item) => item.name}
      />
    );

    expect(getByTestId("item-1")).toHaveTextContent("Item One");
  });

  it("renders a list with multiple items", () => {
    const { getByTestId } = render(
      <TooltipList
        data={data}
        getItemKey={(item) => item._id}
        renderTooltipItem={(item) => item.name}
      />
    );

    expect(getByTestId("item-1")).toHaveTextContent("Item One");
    expect(getByTestId("item-2")).toHaveTextContent("Item Two");
  });

  it("uses getItemKey to generate unique keys", () => {
    const { getByTestId } = render(
      <TooltipList
        data={data}
        getItemKey={(item) => `custom-${item._id}`}
        renderTooltipItem={(item) => item.name}
      />
    );
    expect(getByTestId("custom-item-1")).toBeInTheDocument();
    expect(getByTestId("custom-item-2")).toBeInTheDocument();
  });

  it("falls back to String(item) as key when getItemKey is not provided", () => {
    const primitiveData = ["a", "b"];
    const { getByTestId } = render(<TooltipList data={primitiveData} />);

    expect(getByTestId("a")).toBeInTheDocument();
    expect(getByTestId("b")).toBeInTheDocument();
  });

  it("uses renderTooltipItem to render each item", () => {
    const { getByTestId } = render(
      <TooltipList
        data={data}
        getItemKey={(item) => item._id}
        renderTooltipItem={(item) => <span>Rendered: {item.name}</span>}
      />
    );

    expect(getByTestId("item-1")).toHaveTextContent("Rendered: Item One");
  });

  it("falls back to String(item) as content when renderTooltipItem is not provided", () => {
    const primitiveData = [123, 456];
    const { getByTestId } = render(<TooltipList data={primitiveData} />);
    expect(getByTestId("123")).toHaveTextContent("123");
    expect(getByTestId("456")).toHaveTextContent("456");
  });
});
