import userEvent from "@testing-library/user-event";
import React from "react";
import { axe } from "vitest-axe";

import { TestRouter, render, waitFor, within } from "../../test-utils";
import { SearchParamsProvider } from "../Contexts/SearchParamsContext";

import InstitutionListFilters from "./index";

type Props = {
  initialEntries?: string[];
  children: React.ReactNode;
};
const TestParent: React.FC<Props> = ({ initialEntries = ["/"], children }) => (
  <TestRouter initialEntries={initialEntries}>
    <SearchParamsProvider>{children}</SearchParamsProvider>
  </TestRouter>
);

describe("Accessibility", () => {
  it("should not have any violations", async () => {
    const { container } = render(
      <TestParent>
        <InstitutionListFilters />
      </TestParent>
    );
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});

describe("InstitutionListFilters Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { getByTestId } = render(
      <TestParent>
        <InstitutionListFilters />
      </TestParent>
    );

    expect(getByTestId("institution-filters")).toBeInTheDocument();
  });

  it("updates onChange immediately when selecting a new status", async () => {
    const mockOnChange = vi.fn();
    const { getByTestId, getByRole } = render(
      <TestParent>
        <InstitutionListFilters onChange={mockOnChange} />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("status-select")).toBeInTheDocument();
    });

    const statusSelect = within(getByTestId("status-select")).getByRole("button");
    userEvent.click(statusSelect);

    const muiSelectList = within(getByRole("listbox", { hidden: true }));
    await waitFor(() => {
      expect(muiSelectList.getByTestId("status-option-All")).toBeInTheDocument();
      expect(muiSelectList.getByTestId("status-option-Active")).toBeInTheDocument();
      expect(muiSelectList.getByTestId("status-option-Inactive")).toBeInTheDocument();
    });

    userEvent.click(muiSelectList.getByTestId("status-option-Active"));

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({ name: "", status: "Active" });
    });
  });

  it("renders name input and status select fields", () => {
    const { getByTestId } = render(
      <TestParent>
        <InstitutionListFilters />
      </TestParent>
    );

    expect(getByTestId("name-input")).toBeInTheDocument();
    expect(getByTestId("status-select")).toBeInTheDocument();
    expect(getByTestId("status-select-input")).toBeInTheDocument();
  });

  it("calls onChange with default values on initial render", async () => {
    const mockOnChange = vi.fn();
    render(
      <TestParent>
        <InstitutionListFilters onChange={mockOnChange} />
      </TestParent>
    );

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({ name: "", status: "All" });
    });
  });

  it("initializes form fields based on URL search params", async () => {
    const initialEntries = ["/?name=TestName&status=Active"];
    const mockOnChange = vi.fn();
    const { getByTestId } = render(
      <TestParent initialEntries={initialEntries}>
        <InstitutionListFilters onChange={mockOnChange} />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("name-input")).toHaveValue("TestName");
      expect(getByTestId("status-select-input")).toHaveValue("Active");
    });
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({ name: "TestName", status: "Active" });
    });
  });

  it("debounces onChange after entering a value in the name input", async () => {
    vi.useFakeTimers();
    const mockOnChange = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <InstitutionListFilters onChange={mockOnChange} />
      </TestParent>
    );

    const nameInput = getByTestId("name-input");

    userEvent.clear(nameInput);
    userEvent.type(nameInput, "Test");

    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({ name: "Test", status: "All" });
    });
    vi.useRealTimers();
  });

  it("calls onChange after clearing the name input", async () => {
    vi.useFakeTimers();
    const mockOnChange = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <InstitutionListFilters onChange={mockOnChange} />
      </TestParent>
    );
    const nameInput = getByTestId("name-input");

    userEvent.type(nameInput, "TestName");
    vi.advanceTimersByTime(500);
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({ name: "TestName", status: "All" });
    });

    userEvent.clear(nameInput);
    vi.advanceTimersByTime(500);
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({ name: "", status: "All" });
    });
    vi.useRealTimers();
  });
});
