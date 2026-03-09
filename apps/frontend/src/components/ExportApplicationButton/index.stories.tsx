import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";
import { screen, userEvent, within } from "@storybook/test";
import React from "react";

import { Context as FormContext } from "@/components/Contexts/FormContext";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { formContextStateFactory } from "@/factories/application/FormContextStateFactory";
import { questionnaireDataFactory } from "@/factories/application/QuestionnaireDataFactory";
import { organizationFactory } from "@/factories/auth/OrganizationFactory";
import { institutionFactory } from "@/factories/institution/InstitutionFactory";
import {
  LIST_INSTITUTIONS,
  LIST_ORGS,
  ListInstitutionsInput,
  ListInstitutionsResp,
  ListOrgsInput,
  ListOrgsResp,
} from "@/graphql";

import Button from "./index";

type CustomStoryProps = React.ComponentProps<typeof Button>;

const institutionsMock: MockedResponse<ListInstitutionsResp, ListInstitutionsInput> = {
  request: {
    query: LIST_INSTITUTIONS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listInstitutions: {
        total: 3,
        institutions: [
          ...institutionFactory.build(5, (idx) => ({
            _id: `institution-${idx}`,
            name: `Institution ${idx + 1}`,
            status: "Active",
          })),
        ],
      },
    },
  },
};

const listOrgsMock: MockedResponse<ListOrgsResp, ListOrgsInput> = {
  request: {
    query: LIST_ORGS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listPrograms: {
        total: 3,
        programs: [
          ...organizationFactory.build(3, (idx) => ({
            _id: `program-${idx + 1}`,
            name: `Program ${idx + 1}`,
            abbreviation: `PRG-${idx + 1}`,
            description: `Description for Program ${idx + 1}`,
            status: "Active",
          })),
        ],
      },
    },
  },
};

const mockQuestionnaireData = questionnaireDataFactory.build();
const mockApplication = applicationFactory.build({
  version: "3.5",
  questionnaireData: mockQuestionnaireData,
});
const mockFormState = formContextStateFactory.build({
  data: mockApplication,
});

const withFormContext = (Story: React.ComponentType) => (
  <FormContext.Provider value={mockFormState}>
    <Story />
  </FormContext.Provider>
);

const meta: Meta<CustomStoryProps> = {
  title: "Submission Requests / Export Application Button",
  component: Button,
  tags: ["autodocs"],
  decorators: [withFormContext],
  parameters: {
    apolloClient: {
      mocks: [institutionsMock, listOrgsMock],
    },
  },
  argTypes: {},
} satisfies Meta<CustomStoryProps>;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    ...Default.args,
    disabled: true,
  },
};

export const Hovered: Story = {
  args: {
    ...Default.args,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId("export-application-excel-button-text");

    await userEvent.hover(button);

    await screen.findByRole("tooltip");
  },
};

export default meta;
