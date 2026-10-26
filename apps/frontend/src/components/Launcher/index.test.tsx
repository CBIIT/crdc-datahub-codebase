import userEvent from "@testing-library/user-event";
import { FC } from "react";
import { axe } from "vitest-axe";

import { render, waitFor } from "@/test-utils";

import { LauncherItem, LauncherProvider, useLauncherItem } from "../Contexts/LauncherContext";

import Launcher from ".";

const ChatIcon: FC = () => <span>C</span>;
const MessagesIcon: FC = () => <span>M</span>;

const chatItem: LauncherItem = {
  id: "chatbot",
  label: "Chat with us",
  icon: ChatIcon,
  gradient: "linear-gradient(180deg, #006374 0%, #13AA84 100%)",
  order: 1,
  onClick: vi.fn(),
};

const messagesItem: LauncherItem = {
  id: "srf-messaging",
  label: "Messages",
  icon: MessagesIcon,
  gradient: "linear-gradient(180deg, #083A50 0%, #13AA84 100%)",
  order: 2,
  onClick: vi.fn(),
};

const TestItem: FC<{ item: LauncherItem }> = ({ item }) => {
  useLauncherItem(item);
  return null;
};

type TestParentProps = {
  items?: LauncherItem[];
};

const TestParent: FC<TestParentProps> = ({ items = [] }) => (
  <LauncherProvider>
    {items.map((item) => (
      <TestItem key={item.id} item={item} />
    ))}
    <Launcher />
  </LauncherProvider>
);

describe("Accessibility", () => {
  it("should have no accessibility violations", async () => {
    const { container, getByRole } = render(<TestParent items={[chatItem, messagesItem]} />);

    expect(getByRole("complementary", { name: "Feature launcher" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render the launcher when no items are visible", () => {
    const { queryByRole } = render(<TestParent />);

    expect(queryByRole("complementary", { name: "Feature launcher" })).not.toBeInTheDocument();
  });

  it("should show each item as a button in the launcher", () => {
    const { getByRole } = render(<TestParent items={[chatItem, messagesItem]} />);

    expect(getByRole("button", { name: "Chat with us" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Messages" })).toBeInTheDocument();
  });

  it("should call the item's onClick when clicked and keep the launcher open", async () => {
    const onClick = vi.fn();
    const { getByRole } = render(<TestParent items={[{ ...chatItem, onClick }]} />);

    userEvent.click(getByRole("button", { name: "Chat with us" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(getByRole("complementary", { name: "Feature launcher" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Chat with us" })).toBeInTheDocument();
  });

  it("should show an item as active while its feature is open", () => {
    const { getByRole, rerender } = render(<TestParent items={[chatItem]} />);

    expect(getByRole("button", { name: "Chat with us" })).toHaveAttribute("aria-pressed", "false");

    rerender(<TestParent items={[{ ...chatItem, isActive: true }]} />);

    expect(getByRole("button", { name: "Chat with us" })).toHaveAttribute("aria-pressed", "true");

    rerender(<TestParent items={[{ ...chatItem, isActive: false }]} />);

    expect(getByRole("button", { name: "Chat with us" })).toHaveAttribute("aria-pressed", "false");
  });

  it("should remove an item when its component unmounts", () => {
    const { getByRole, queryByRole, rerender } = render(
      <TestParent items={[chatItem, messagesItem]} />
    );

    expect(getByRole("button", { name: "Messages" })).toBeInTheDocument();

    rerender(<TestParent items={[chatItem]} />);

    expect(getByRole("button", { name: "Chat with us" })).toBeInTheDocument();
    expect(queryByRole("button", { name: "Messages" })).not.toBeInTheDocument();
  });

  it("should order items by their order values", () => {
    const { getAllByRole, getByRole } = render(
      <TestParent
        items={[
          { ...chatItem, id: "third", label: "Third", order: 30 },
          { ...chatItem, id: "first", label: "First", order: 10 },
          { ...chatItem, id: "second", label: "Second", order: 20 },
        ]}
      />
    );

    expect(getAllByRole("button")).toEqual([
      getByRole("button", { name: "First" }),
      getByRole("button", { name: "Second" }),
      getByRole("button", { name: "Third" }),
    ]);
  });

  it("should show a tooltip when hovering or focusing an item", async () => {
    const { getByRole, findByRole, queryByRole } = render(<TestParent items={[chatItem]} />);

    const button = getByRole("button", { name: "Chat with us" });

    userEvent.hover(button);

    expect(await findByRole("tooltip")).toHaveTextContent("Chat with us");

    userEvent.unhover(button);

    await waitFor(() => {
      expect(queryByRole("tooltip")).not.toBeInTheDocument();
    });

    userEvent.tab();

    expect(button).toHaveFocus();
    expect(await findByRole("tooltip")).toHaveTextContent("Chat with us");
  });

  it("should throw an error when hook is used outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Launcher />)).toThrow(
      "useLauncherItems must be used within LauncherProvider"
    );

    vi.spyOn(console, "error").mockRestore();
  });
});
