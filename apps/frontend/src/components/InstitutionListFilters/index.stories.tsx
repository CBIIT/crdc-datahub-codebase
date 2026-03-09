import type { Meta, StoryObj } from "@storybook/react";
import { fn, userEvent, within } from "@storybook/test";

import { SearchParamsProvider } from "../Contexts/SearchParamsContext";

import InstitutionListFilters from "./index";

const meta: Meta<typeof InstitutionListFilters> = {
  title: "Admin Portal / InstitutionListFilters",
  component: InstitutionListFilters,
  decorators: [
    (Story) => (
      <SearchParamsProvider>
        <Story />
      </SearchParamsProvider>
    ),
  ],
  args: {
    onChange: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof InstitutionListFilters>;

export const Default: Story = {
  args: {},
};

export const Interactive: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Simulate user entering a name into the text input
    const nameInput = canvas.getByTestId("name-input");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Test Institution");

    // Simulate user selecting "Active" from the status dropdown
    const statusSelect = within(canvas.getByTestId("status-select")).getByRole("button");
    await userEvent.click(statusSelect);
    const activeOption = canvas.getByTestId("status-option-Active");
    await userEvent.click(activeOption);
  },
};
