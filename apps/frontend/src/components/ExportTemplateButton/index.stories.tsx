import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";
import { screen, userEvent, within } from "@storybook/test";

import { organizationFactory } from "@/factories/auth/OrganizationFactory";
import { institutionFactory } from "@/factories/institution/InstitutionFactory";
import {
  ListInstitutionsResp,
  ListInstitutionsInput,
  LIST_INSTITUTIONS,
  GetApplicationFormVersionResp,
  GET_APPLICATION_FORM_VERSION,
  LIST_ORGS,
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

const retrieveFormVersionMock: MockedResponse<GetApplicationFormVersionResp> = {
  request: {
    query: GET_APPLICATION_FORM_VERSION,
  },
  result: {
    data: {
      getApplicationFormVersion: {
        _id: "a mock uuid",
        version: "1.0.0",
      },
    },
  },
};

const meta: Meta<CustomStoryProps> = {
  title: "Submission Requests / Export Template Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    apolloClient: {
      mocks: [institutionsMock, listOrgsMock, retrieveFormVersionMock],
    },
  },
  argTypes: {},
} satisfies Meta<CustomStoryProps>;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

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
    const button = canvas.getByTestId("export-application-excel-template-button");

    await userEvent.hover(button);

    await screen.findByRole("tooltip");
  },
};

export default meta;
