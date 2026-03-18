import userEvent from "@testing-library/user-event";
import { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { formContextStateFactory } from "@/factories/application/FormContextStateFactory";
import { repositoryFactory } from "@/factories/application/RepositoryFactory";

import { render, RenderResult, waitFor, within } from "../../test-utils";
import {
  ContextState as FormContextState,
  Context as FormContext,
  Status as FormStatus,
} from "../Contexts/FormContext";

import Repository, { repositoryDataTypesOptions } from "./Repository";

/**
 * Helper to get form elements by their test IDs
 */
const getFormElements = (
  { getByTestId }: Pick<RenderResult, "getByTestId">,
  index: number,
  idPrefix = ""
) => {
  const testIdPrefix = `${idPrefix}repository-${index}`;
  return {
    container: () => getByTestId(testIdPrefix),
    repositoryName: () => getByTestId(`${testIdPrefix}-name`),
    studyId: () => getByTestId(`${testIdPrefix}-study-id`),
    dataTypesSubmitted: () => getByTestId(`${testIdPrefix}-data-types-submitted`),
    otherDataTypes: () => getByTestId(`${testIdPrefix}-other-data-types-submitted`),
    otherDataTypesInput: () =>
      within(getByTestId(`${testIdPrefix}-other-data-types-submitted`)).getByRole("textbox", {
        hidden: true,
      }),
    removeButton: () => getByTestId(`${testIdPrefix}-remove-button`),
  };
};

/**
 * Helper to open the data types select dropdown
 */
const openDataTypesSelect = async (
  { getByTestId }: Pick<RenderResult, "getByTestId">,
  index: number,
  idPrefix = ""
) => {
  const testIdPrefix = `${idPrefix}repository-${index}`;
  const selectWrapper = getByTestId(`${testIdPrefix}-data-types-submitted`);
  const selectButton = within(selectWrapper).getByRole("button");
  userEvent.click(selectButton);
};

/**
 * Helper to get the MUI listbox (not the native select element)
 */
const getMuiListbox = ({ getAllByRole }: Pick<RenderResult, "getAllByRole">) => {
  const listboxes = getAllByRole("listbox", { hidden: true });
  return listboxes.find((el) => el.tagName === "UL");
};

type TestParentProps = {
  formStatus?: FormStatus;
  children: React.ReactNode;
};

const TestParent: FC<TestParentProps> = ({
  formStatus = FormStatus.LOADED,
  children,
}: TestParentProps) => {
  const formValue = useMemo<FormContextState>(
    () =>
      formContextStateFactory.build({
        status: formStatus,
      }),
    [formStatus]
  );

  return <FormContext.Provider value={formValue}>{children}</FormContext.Provider>;
};

describe("Accessibility", () => {
  it("should not have any violations", async () => {
    const mockRepository = repositoryFactory.build({
      name: "GEO",
      studyID: "GSE123456",
      dataTypesSubmitted: ["genomics"],
    });

    const { container } = render(
      <Repository index={0} repository={mockRepository} onDelete={vi.fn()} />,
      { wrapper: TestParent }
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    const mockRepository = repositoryFactory.build();

    expect(() =>
      render(<Repository index={0} repository={mockRepository} onDelete={vi.fn()} />, {
        wrapper: TestParent,
      })
    ).not.toThrow();
  });

  it("should render all required form fields", () => {
    const mockRepository = repositoryFactory.build({
      name: "GEO",
      studyID: "GSE123456",
      dataTypesSubmitted: ["genomics"],
    });

    const { getByTestId } = render(
      <Repository index={0} repository={mockRepository} onDelete={vi.fn()} />,
      { wrapper: TestParent }
    );

    const elements = getFormElements({ getByTestId }, 0);
    expect(elements.repositoryName()).toBeInTheDocument();
    expect(elements.studyId()).toBeInTheDocument();
    expect(elements.dataTypesSubmitted()).toBeInTheDocument();
    expect(elements.otherDataTypes()).toBeInTheDocument();
  });

  it("should display the repository name value", () => {
    const mockRepository = repositoryFactory.build({
      name: "Test Repository",
      studyID: "TEST-001",
      dataTypesSubmitted: [],
    });

    const { getByDisplayValue } = render(
      <Repository index={0} repository={mockRepository} onDelete={vi.fn()} />,
      { wrapper: TestParent }
    );

    expect(getByDisplayValue("Test Repository")).toBeInTheDocument();
    expect(getByDisplayValue("TEST-001")).toBeInTheDocument();
  });

  it("should render the Remove Repository button", () => {
    const mockRepository = repositoryFactory.build();

    const { getByTestId } = render(
      <Repository index={0} repository={mockRepository} onDelete={vi.fn()} />,
      { wrapper: TestParent }
    );

    expect(getFormElements({ getByTestId }, 0).removeButton()).toBeInTheDocument();
  });

  it("should call onDelete when Remove Repository button is clicked", async () => {
    const mockRepository = repositoryFactory.build();
    const mockOnDelete = vi.fn();

    const { getByTestId } = render(
      <Repository index={0} repository={mockRepository} onDelete={mockOnDelete} />,
      { wrapper: TestParent }
    );

    userEvent.click(getFormElements({ getByTestId }, 0).removeButton());

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it("should disable Remove Repository button when readOnly is true", () => {
    const mockRepository = repositoryFactory.build();

    const { getByTestId } = render(
      <Repository index={0} repository={mockRepository} onDelete={vi.fn()} readOnly />,
      { wrapper: TestParent }
    );

    expect(getFormElements({ getByTestId }, 0).removeButton()).toBeDisabled();
  });

  it("should disable Remove Repository button when form status is SAVING", () => {
    const mockRepository = repositoryFactory.build();

    const { getByTestId } = render(
      <Repository index={0} repository={mockRepository} onDelete={vi.fn()} />,
      { wrapper: (p) => <TestParent {...p} formStatus={FormStatus.SAVING} /> }
    );

    expect(getFormElements({ getByTestId }, 0).removeButton()).toBeDisabled();
  });

  it("should use idPrefix in element IDs when provided", () => {
    const mockRepository = repositoryFactory.build();

    const { container } = render(
      <Repository
        idPrefix="test-prefix-"
        index={0}
        repository={mockRepository}
        onDelete={vi.fn()}
      />,
      { wrapper: TestParent }
    );

    expect(container.querySelector("#test-prefix-repository-0-name")).toBeInTheDocument();
    expect(container.querySelector("#test-prefix-repository-0-study-id")).toBeInTheDocument();
  });

  it("should handle null repository prop gracefully", () => {
    expect(() =>
      render(<Repository index={0} repository={null} onDelete={vi.fn()} />, {
        wrapper: TestParent,
      })
    ).not.toThrow();
  });

  it("should render correct data type options in the select", async () => {
    const mockRepository = repositoryFactory.build();

    const { getByTestId, getAllByRole } = render(
      <Repository index={0} repository={mockRepository} onDelete={vi.fn()} />,
      { wrapper: TestParent }
    );

    await openDataTypesSelect({ getByTestId }, 0);

    await waitFor(() => {
      const listbox = getMuiListbox({ getAllByRole });
      expect(listbox).toBeInTheDocument();
    });

    const listbox = within(getMuiListbox({ getAllByRole }));

    repositoryDataTypesOptions.forEach((option) => {
      expect(listbox.getByText(option.label)).toBeInTheDocument();
    });
  });
});

describe("Implementation Requirements", () => {
  it("should have 'Other' as a data type option", () => {
    const otherOption = repositoryDataTypesOptions.find((opt) => opt.name === "Other");

    expect(otherOption).toBeDefined();
    expect(otherOption.label).toBe("Other");
  });

  it("should disable Other Data Type(s) field when 'Other' is not selected", () => {
    const mockRepository = repositoryFactory.build({
      dataTypesSubmitted: ["genomics"],
    });

    const { getByTestId } = render(
      <Repository index={0} repository={mockRepository} onDelete={vi.fn()} />,
      { wrapper: TestParent }
    );

    expect(getFormElements({ getByTestId }, 0).otherDataTypesInput()).toHaveAttribute("readonly");
  });

  it("should enable Other Data Type(s) field when 'Other' is selected", () => {
    const mockRepository = repositoryFactory.build({
      dataTypesSubmitted: ["Other"],
    });

    const { getByTestId } = render(
      <Repository index={0} repository={mockRepository} onDelete={vi.fn()} />,
      { wrapper: TestParent }
    );

    expect(getFormElements({ getByTestId }, 0).otherDataTypesInput()).not.toHaveAttribute(
      "readonly"
    );
  });

  it("should enable Other Data Type(s) field when 'Other' is among multiple selected types", () => {
    const mockRepository = repositoryFactory.build({
      dataTypesSubmitted: ["genomics", "Other", "imaging"],
    });

    const { getByTestId } = render(
      <Repository index={0} repository={mockRepository} onDelete={vi.fn()} />,
      { wrapper: TestParent }
    );

    expect(getFormElements({ getByTestId }, 0).otherDataTypesInput()).not.toHaveAttribute(
      "readonly"
    );
  });

  it("should display otherDataTypesSubmitted value when provided", () => {
    const mockRepository = repositoryFactory.build({
      dataTypesSubmitted: ["Other"],
      otherDataTypesSubmitted: "customType1 | customType2",
    });

    const { getByDisplayValue } = render(
      <Repository index={0} repository={mockRepository} onDelete={vi.fn()} />,
      { wrapper: TestParent }
    );

    expect(getByDisplayValue("customType1 | customType2")).toBeInTheDocument();
  });

  it("should disable Other Data Type(s) field when readOnly is true even if 'Other' is selected", () => {
    const mockRepository = repositoryFactory.build({
      dataTypesSubmitted: ["Other"],
    });

    const { getByTestId } = render(
      <Repository index={0} repository={mockRepository} onDelete={vi.fn()} readOnly />,
      { wrapper: TestParent }
    );

    expect(getFormElements({ getByTestId }, 0).otherDataTypesInput()).toHaveAttribute("readonly");
  });

  it("should update Other Data Type(s) field state when selecting 'Other' option", async () => {
    const mockRepository = repositoryFactory.build({
      dataTypesSubmitted: [],
    });

    const { getByTestId, getAllByRole } = render(
      <Repository index={0} repository={mockRepository} onDelete={vi.fn()} />,
      { wrapper: TestParent }
    );

    const elements = getFormElements({ getByTestId }, 0);
    expect(elements.otherDataTypesInput()).toHaveAttribute("readonly");

    await openDataTypesSelect({ getByTestId }, 0);

    await waitFor(() => {
      const listbox = getMuiListbox({ getAllByRole });
      expect(listbox).toBeInTheDocument();
    });

    const listbox = within(getMuiListbox({ getAllByRole }));
    userEvent.click(listbox.getByText("Other"));

    await waitFor(() => {
      expect(elements.otherDataTypesInput()).not.toHaveAttribute("readonly");
    });
  });

  it("should disable Other Data Type(s) field state when deselecting 'Other' option", async () => {
    const mockRepository = repositoryFactory.build({
      dataTypesSubmitted: ["Other"],
    });

    const { getByTestId, getAllByRole } = render(
      <Repository index={0} repository={mockRepository} onDelete={vi.fn()} />,
      { wrapper: TestParent }
    );

    const elements = getFormElements({ getByTestId }, 0);
    expect(elements.otherDataTypesInput()).not.toHaveAttribute("readonly");

    await openDataTypesSelect({ getByTestId }, 0);

    await waitFor(() => {
      const listbox = getMuiListbox({ getAllByRole });
      expect(listbox).toBeInTheDocument();
    });

    const listbox = within(getMuiListbox({ getAllByRole }));
    userEvent.click(listbox.getByText("Other"));

    await waitFor(() => {
      expect(elements.otherDataTypesInput()).toHaveAttribute("readonly");
    });
  });

  it("should update otherDataTypes when the repository prop changes after initial render", () => {
    const initialRepository = repositoryFactory.build({
      dataTypesSubmitted: ["Other"],
      otherDataTypesSubmitted: "",
    });

    const { rerender, getByTestId } = render(
      <TestParent>
        <Repository index={0} repository={initialRepository} onDelete={vi.fn()} />
      </TestParent>
    );

    const elements = getFormElements({ getByTestId }, 0);
    expect(elements.otherDataTypesInput()).toHaveValue("");

    const updatedRepository = repositoryFactory.build({
      dataTypesSubmitted: ["Other"],
      otherDataTypesSubmitted: "imported | values",
    });

    rerender(
      <TestParent>
        <Repository index={0} repository={updatedRepository} onDelete={vi.fn()} />
      </TestParent>
    );

    expect(elements.otherDataTypesInput()).toHaveValue("imported | values");
  });

  it("should update dataTypes when the repository prop changes after initial render", async () => {
    const initialRepository = repositoryFactory.build({
      dataTypesSubmitted: [],
      otherDataTypesSubmitted: "",
    });

    const { rerender, getByTestId } = render(
      <TestParent>
        <Repository index={0} repository={initialRepository} onDelete={vi.fn()} />
      </TestParent>
    );

    const elements = getFormElements({ getByTestId }, 0);
    expect(elements.otherDataTypesInput()).toHaveAttribute("readonly");

    const updatedRepository = repositoryFactory.build({
      dataTypesSubmitted: ["Other"],
      otherDataTypesSubmitted: "new data",
    });

    rerender(
      <TestParent>
        <Repository index={0} repository={updatedRepository} onDelete={vi.fn()} />
      </TestParent>
    );

    await waitFor(() => {
      expect(elements.otherDataTypesInput()).not.toHaveAttribute("readonly");
    });
    expect(elements.otherDataTypesInput()).toHaveValue("new data");
  });
});
