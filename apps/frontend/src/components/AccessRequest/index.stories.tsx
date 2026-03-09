import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within, screen, expect } from "@storybook/test";

import { approvedStudyFactory } from "@/factories/approved-study/ApprovedStudyFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { institutionFactory } from "@/factories/institution/InstitutionFactory";

import { Roles } from "../../config/AuthRoles";
import {
  LIST_APPROVED_STUDIES,
  LIST_INSTITUTIONS,
  ListApprovedStudiesInput,
  ListApprovedStudiesResp,
  ListInstitutionsInput,
  ListInstitutionsResp,
} from "../../graphql";
import { Context as AuthContext } from "../Contexts/AuthContext";

import Dialog from "./index";

const meta: Meta<typeof Dialog> = {
  title: "Dialogs / Access Request",
  component: Dialog,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const studiesMock: MockedResponse<ListApprovedStudiesResp, ListApprovedStudiesInput> = {
  request: {
    query: LIST_APPROVED_STUDIES,
  },
  result: {
    data: {
      listApprovedStudies: {
        total: 2,
        studies: [
          approvedStudyFactory.build({
            _id: "study-1",
            studyName: "Study-1",
            studyAbbreviation: "S1",
            controlledAccess: false,
            openAccess: false,
            dbGaPID: null,
            ORCID: "",
            originalOrg: null,
            PI: "",
            primaryContact: null,
            program: null,
            useProgramPC: false,
            createdAt: "",
            pendingModelChange: false,
          }),
          approvedStudyFactory.build({
            _id: "study-2",
            studyName: "Study-2",
            studyAbbreviation: "S2",
            controlledAccess: false,
            openAccess: false,
            dbGaPID: null,
            ORCID: "",
            originalOrg: null,
            PI: "",
            primaryContact: null,
            program: null,
            useProgramPC: false,
            createdAt: "",
            pendingModelChange: false,
          }),
        ],
      },
    },
  },
  variableMatcher: () => true,
};

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
          institutionFactory.build({
            _id: "institution-1",
            name: "Institution 1",
            status: "Active",
            submitterCount: 0,
          }),
          institutionFactory.build({
            _id: "institution-2",
            name: "Institution 2",
            status: "Active",
            submitterCount: 5,
          }),
          institutionFactory.build({
            _id: "institution-3",
            name: "Institution 3",
            status: "Active",
            submitterCount: 2,
          }),
        ],
      },
    },
  },
};

export const Default: Story = {
  args: {
    role: "Submitter",
    permissions: ["access:request"],
  },
  argTypes: {
    role: {
      name: "Role",
      options: Roles,
      control: {
        type: "radio",
      },
    },
    permissions: {
      name: "Permissions",
      options: ["access:request"],
      control: {
        type: "check",
      },
    },
  },
  parameters: {
    apolloClient: {
      mocks: [studiesMock, institutionsMock],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    canvas.getByText("Request Access").click();

    await canvas.findByText("Request Access");
  },
  decorators: [
    (Story, context) => (
      <AuthContext.Provider
        value={authCtxStateFactory.build({
          isLoggedIn: true,
          user: userFactory.build({
            firstName: "Example",
            role: context.args.role,
            permissions: context.args.permissions,
          }),
        })}
      >
        <Story />
      </AuthContext.Provider>
    ),
  ],
};

export const Hovered: Story = {
  args: {
    role: "Submitter",
    permissions: ["access:request"],
  },
  parameters: {
    apolloClient: {
      mocks: [studiesMock, institutionsMock],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId("request-access-button");
    userEvent.hover(button);
    const tooltip = await screen.findByText(
      /Request role change, study access, or institution update./i
    );
    expect(tooltip).toBeInTheDocument();
  },
  decorators: [
    (Story, context) => (
      <AuthContext.Provider
        value={authCtxStateFactory.build({
          isLoggedIn: true,
          user: userFactory.build({
            firstName: "Example",
            role: context.args.role,
            permissions: context.args.permissions,
          }),
        })}
      >
        <Story />
      </AuthContext.Provider>
    ),
  ],
};
