import { FC } from "react";

import { render } from "@/test-utils";

import {
  LauncherItem,
  LauncherProvider,
  useLauncherItem,
  useLauncherItems,
} from "./LauncherContext";

const TestIcon: FC = () => <span aria-hidden="true">C</span>;

const baseItem: LauncherItem = {
  id: "chatbot",
  label: "Chat with us",
  icon: TestIcon,
  gradient: "linear-gradient(180deg, #006374 0%, #13AA84 100%)",
  order: 1,
  onClick: vi.fn(),
};

const TestItem: FC<{ item: LauncherItem }> = ({ item }) => {
  useLauncherItem(item);
  return null;
};

type TestReaderProps = {
  onRender: (items: readonly LauncherItem[]) => void;
};

const TestReader: FC<TestReaderProps> = ({ onRender }) => {
  onRender(useLauncherItems());
  return null;
};

type TestParentProps = {
  items: LauncherItem[];
  onRender: (items: readonly LauncherItem[]) => void;
};

const TestParent: FC<TestParentProps> = ({ items, onRender }) => (
  <LauncherProvider>
    {items.map((item) => (
      <TestItem key={item.id} item={item} />
    ))}
    <TestReader onRender={onRender} />
  </LauncherProvider>
);

describe("LauncherContext", () => {
  let items: readonly LauncherItem[];
  const captureItems = (value: readonly LauncherItem[]) => {
    items = value;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    items = undefined;
  });

  it("should register an item while its component is mounted", () => {
    render(<TestParent items={[baseItem]} onRender={captureItems} />);

    expect(items.map((item) => item.id)).toEqual(["chatbot"]);
  });

  it("should unregister an item when its component unmounts", () => {
    const { rerender } = render(<TestParent items={[baseItem]} onRender={captureItems} />);

    rerender(<TestParent items={[]} onRender={captureItems} />);

    expect(items).toEqual([]);
  });

  it("should return registered items with their config", () => {
    render(<TestParent items={[{ ...baseItem, isActive: true }]} onRender={captureItems} />);

    expect(items).toEqual([
      expect.objectContaining({
        id: "chatbot",
        label: "Chat with us",
        icon: TestIcon,
        gradient: baseItem.gradient,
        order: 1,
        isActive: true,
      }),
    ]);
  });

  it("should sort items by order, placing items without an order last", () => {
    render(
      <TestParent
        items={[
          { ...baseItem, id: "no-order", order: undefined },
          { ...baseItem, id: "third", order: 30 },
          { ...baseItem, id: "first", order: 10 },
          { ...baseItem, id: "second", order: 20 },
        ]}
        onRender={captureItems}
      />
    );

    expect(items.map((item) => item.id)).toEqual(["first", "second", "third", "no-order"]);
  });

  it("should update an item in place when its values change", () => {
    const { rerender } = render(
      <TestParent
        items={[
          { ...baseItem, id: "a", order: undefined },
          { ...baseItem, id: "b", order: undefined },
        ]}
        onRender={captureItems}
      />
    );

    rerender(
      <TestParent
        items={[
          { ...baseItem, id: "a", order: undefined, isActive: true },
          { ...baseItem, id: "b", order: undefined },
        ]}
        onRender={captureItems}
      />
    );

    expect(items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(items[0].isActive).toBe(true);
  });

  it("should throw an error when useLauncherItem is used outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<TestItem item={baseItem} />)).toThrow(
      "useLauncherItem must be used within LauncherProvider"
    );

    vi.spyOn(console, "error").mockRestore();
  });

  it("should throw an error when useLauncherItems is used outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<TestReader onRender={captureItems} />)).toThrow(
      "useLauncherItems must be used within LauncherProvider"
    );

    vi.spyOn(console, "error").mockRestore();
  });
});
