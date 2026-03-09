import userEvent from "@testing-library/user-event";
import React from "react";
import { axe } from "vitest-axe";

import { releasedStudyFactory } from "@/factories/approved-study/ReleasedStudyFactory";

import { SearchParamsProvider } from "../../components/Contexts/SearchParamsContext";
import { TestRouter, render, waitFor, within } from "../../test-utils";

import ListFilters, { defaultValues } from "./ListFilters";

const mockData = {
  total: 2,
  dataCommonsDisplayNames: ["CommonsA", "CommonsB"],
  studies: [
    releasedStudyFactory.build({
      _id: "1",
      studyName: "StudyA",
      dbGaPID: "DB1",
      studyAbbreviation: "SA",
      dataCommons: ["CommonsA"],
      dataCommonsDisplayNames: ["CommonsA"],
    }),
    releasedStudyFactory.build({
      _id: "2",
      studyName: "StudyB",
      dbGaPID: "DB2",
      studyAbbreviation: "SB",
      dataCommons: ["CommonsB"],
      dataCommonsDisplayNames: ["CommonsB"],
    }),
  ],
};

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
  beforeEach(() => {
    vi.resetModules();
  });

  it("should not have any accessibility violations", async () => {
    const { container } = render(
      <TestParent>
        <ListFilters dataCommonsDisplayNames={mockData.dataCommonsDisplayNames} />
      </TestParent>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("ListFilters", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("renders all input fields and reset button", () => {
    const { getByTestId } = render(
      <TestParent>
        <ListFilters dataCommonsDisplayNames={mockData.dataCommonsDisplayNames} />
      </TestParent>
    );

    expect(getByTestId("name-input")).toBeInTheDocument();
    expect(getByTestId("dbGaPID-input")).toBeInTheDocument();
    expect(getByTestId("data-commons-display-names-select")).toBeInTheDocument();
    expect(getByTestId("data-commons-display-names-select-input")).toBeInTheDocument();
    expect(getByTestId("reset-filters-button")).toBeInTheDocument();
  });

  it("calls onChange with default values on initial render", async () => {
    const mockOnChange = vi.fn();
    render(
      <TestParent>
        <ListFilters
          dataCommonsDisplayNames={mockData.dataCommonsDisplayNames}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(defaultValues);
    });
  });

  it("initializes form fields based on URL search params", async () => {
    const initialEntries = ["/?name=StudyX&dbGaPID=DB123&dataCommonsDisplayNames=CommonsB"];
    const mockOnChange = vi.fn();
    const { getByTestId } = render(
      <TestParent initialEntries={initialEntries}>
        <ListFilters
          dataCommonsDisplayNames={mockData.dataCommonsDisplayNames}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("name-input")).toHaveValue("StudyX");
      expect(getByTestId("dbGaPID-input")).toHaveValue("DB123");
      expect(getByTestId("data-commons-display-names-select-input")).toHaveValue("CommonsB");
    });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({
        name: "StudyX",
        dbGaPID: "DB123",
        dataCommonsDisplayNames: "CommonsB",
      });
    });
  });

  it("debounces onChange after entering a value in the name input", async () => {
    const mockOnChange = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <ListFilters
          dataCommonsDisplayNames={mockData.dataCommonsDisplayNames}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    const nameInput = getByTestId("name-input");

    userEvent.clear(nameInput);
    userEvent.type(nameInput, "Test");

    await waitFor(
      () => {
        expect(mockOnChange).toHaveBeenCalledWith({
          name: "Test",
          dbGaPID: "",
          dataCommonsDisplayNames: "All",
        });
      },
      { timeout: 5000 }
    );

    userEvent.clear(nameInput);
  });

  it("calls onChange when selecting a new dataCommonsDisplayNames option", async () => {
    const mockOnChange = vi.fn();
    const { getByTestId, getByRole } = render(
      <TestParent>
        <ListFilters
          dataCommonsDisplayNames={mockData.dataCommonsDisplayNames}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("data-explorer-filters")).toBeInTheDocument();
    });

    const selectButton = within(getByTestId("data-commons-display-names-select")).getByRole(
      "button"
    );
    userEvent.click(selectButton);

    const muiSelectList = within(getByRole("listbox", { hidden: true }));

    await waitFor(() => {
      expect(
        muiSelectList.getByTestId("data-commons-display-names-option-CommonsA")
      ).toBeInTheDocument();
      expect(
        muiSelectList.getByTestId("data-commons-display-names-option-CommonsB")
      ).toBeInTheDocument();
    });

    userEvent.click(muiSelectList.getByTestId("data-commons-display-names-option-CommonsB"));

    await waitFor(() => {
      expect(getByTestId("data-commons-display-names-select-input")).toHaveValue("CommonsB");
    });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({
        name: "",
        dbGaPID: "",
        dataCommonsDisplayNames: "CommonsB",
      });
    });
  });

  it("debounces onChange after entering a value in the dbGaPID input", async () => {
    vi.useFakeTimers();
    const mockOnChange = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <ListFilters
          dataCommonsDisplayNames={mockData.dataCommonsDisplayNames}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    const dbGaPIDInput = getByTestId("dbGaPID-input");

    userEvent.clear(dbGaPIDInput);
    userEvent.type(dbGaPIDInput, "DB456");

    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({
        name: "",
        dbGaPID: "DB456",
        dataCommonsDisplayNames: "All",
      });
    });

    vi.useRealTimers();
  });

  it("resets all filters and clears URL searchParams when reset button is clicked", async () => {
    const initialEntries = ["/?name=StudyY&dbGaPID=DB789&dataCommonsDisplayNames=CommonsA"];
    const mockOnChange = vi.fn();

    const { getByTestId } = render(
      <TestParent initialEntries={initialEntries}>
        <ListFilters
          dataCommonsDisplayNames={mockData.dataCommonsDisplayNames}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("name-input")).toHaveValue("StudyY");
      expect(getByTestId("dbGaPID-input")).toHaveValue("DB789");
      expect(getByTestId("data-commons-display-names-select-input")).toHaveValue("CommonsA");
    });

    userEvent.click(getByTestId("reset-filters-button"));

    await waitFor(() => {
      expect(getByTestId("name-input")).toHaveValue("");
      expect(getByTestId("dbGaPID-input")).toHaveValue("");
      expect(getByTestId("data-commons-display-names-select-input")).toHaveValue("All");
    });
  });

  it("calls onChange after clearing the name input", async () => {
    vi.useFakeTimers();
    const mockOnChange = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <ListFilters
          dataCommonsDisplayNames={mockData.dataCommonsDisplayNames}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    const nameInput = getByTestId("name-input");

    userEvent.type(nameInput, "TestName");

    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({
        name: "TestName",
        dbGaPID: "",
        dataCommonsDisplayNames: "All",
      });
    });

    userEvent.clear(nameInput);

    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({
        name: "",
        dbGaPID: "",
        dataCommonsDisplayNames: "All",
      });
    });

    vi.useRealTimers();
  });

  it("calls onChange after clearing the dbGaPID input", async () => {
    vi.useFakeTimers();
    const mockOnChange = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <ListFilters
          dataCommonsDisplayNames={mockData.dataCommonsDisplayNames}
          onChange={mockOnChange}
        />
      </TestParent>
    );

    const dbGaPIDInput = getByTestId("dbGaPID-input");

    userEvent.type(dbGaPIDInput, "DB999");

    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({
        name: "",
        dbGaPID: "DB999",
        dataCommonsDisplayNames: "All",
      });
    });

    userEvent.clear(dbGaPIDInput);

    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({
        name: "",
        dbGaPID: "",
        dataCommonsDisplayNames: "All",
      });
    });

    vi.useRealTimers();
  });
});
