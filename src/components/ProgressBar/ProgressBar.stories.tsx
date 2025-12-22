import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React, { ComponentPropsWithoutRef } from "react";

import { applicantFactory } from "@/factories/application/ApplicantFactory";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { formContextStateFactory } from "@/factories/application/FormContextStateFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { organizationFactory } from "@/factories/auth/OrganizationFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { institutionFactory } from "@/factories/institution/InstitutionFactory";
import { GET_APPLICATION_FORM_VERSION, LIST_INSTITUTIONS, LIST_ORGS } from "@/graphql";

import { InitialApplication, InitialQuestionnaire } from "../../config/InitialValues";
import config from "../../config/SectionConfig";
import { Context as AuthCtx } from "../Contexts/AuthContext";
import { Context as FormCtx } from "../Contexts/FormContext";

import ProgressBar from "./ProgressBar";

const keys = Object.keys(config) as SectionKey[];

const institutionsMock: MockedResponse = {
  request: {
    query: LIST_INSTITUTIONS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listInstitutions: {
        total: 3,
        institutions: [
          ...institutionFactory.build(5, (idx: number) => ({
            _id: `institution-${idx}`,
            name: `Institution ${idx + 1}`,
            status: "Active" as const,
          })),
        ],
      },
    },
  },
};

const formVersionMock: MockedResponse = {
  request: {
    query: GET_APPLICATION_FORM_VERSION,
  },
  result: {
    data: {
      getApplicationFormVersion: {
        _id: "mock-uuid",
        version: "1.0.0",
      },
    },
  },
};

const listOrgsMock: MockedResponse = {
  request: {
    query: LIST_ORGS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listPrograms: {
        total: 3,
        programs: [
          ...organizationFactory.build(3, (idx: number) => ({
            _id: `program-${idx + 1}`,
            name: `Program ${idx + 1}`,
            status: "Active" as const,
          })),
        ],
      },
    },
  },
};

const BaseApplication: Application = {
  ...InitialApplication,
  applicant: applicantFactory.build({ applicantID: "current-user" }),
  questionnaireData: { ...InitialQuestionnaire },
  status: "In Progress",
};

type ContextArgs = {
  user?: Partial<User>;
  data: Partial<Application>;
};

type ComponentProps = ComponentPropsWithoutRef<typeof ProgressBar>;

type StoryArgs = ContextArgs & ComponentProps;

const withProviders: Decorator<StoryArgs> = (Story, context) => {
  const { user, data } = context.args;

  const authValue = authCtxStateFactory.build({
    user: userFactory.build({
      _id: "current-user",
      permissions: ["submission_request:view", "submission_request:create"],
      ...(user || {}),
    }),
  });

  const formData = applicationFactory.build({
    ...(data || BaseApplication),
  });
  const formValue = formContextStateFactory.build({ data: formData });

  return (
    <MockedProvider mocks={[institutionsMock, formVersionMock, listOrgsMock]} addTypename={false}>
      <AuthCtx.Provider value={authValue}>
        <FormCtx.Provider value={formValue}>
          <Story />
        </FormCtx.Provider>
      </AuthCtx.Provider>
    </MockedProvider>
  );
};

const meta: Meta<StoryArgs> = {
  title: "Submission Requests / ProgressBar",
  component: ProgressBar,
  decorators: [withProviders],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    section: {
      control: { type: "select" },
      options: keys,
    },
    user: {
      control: { type: "object" },
      description: "Auth user object; used only by the provider decorator (not a prop).",
    },
    data: {
      control: { type: "object" },
      description: "Application data; used only by the provider decorator (not a prop).",
    },
  },
  args: {
    section: keys[0],
  },
};

export default meta;

type Story = StoryObj<StoryArgs>;

export const Default: Story = {
  args: {
    section: keys[0],
  },
  render: (args) => <ProgressBar section={args.section} />,
};

export const ActiveSecondSection: Story = {
  args: {
    section: keys[1],
  },
  render: (args) => <ProgressBar section={args.section} />,
};

export const SomeCompleted: Story = {
  args: {
    section: keys[0],
    data: {
      ...BaseApplication,
      questionnaireData: {
        ...BaseApplication.questionnaireData,
        sections: [{ name: keys[1], status: "Completed" }],
      },
    },
  },
  render: (args) => <ProgressBar section={args.section} />,
};

export const ReviewLockedByDefault: Story = {
  args: {
    section: keys[0],
    data: {
      ...BaseApplication,
      questionnaireData: {
        ...BaseApplication.questionnaireData,
        sections: [],
      },
    },
  },
  render: (args) => <ProgressBar section={args.section} />,
};

export const ReviewEnabledWhenAllSectionsCompleted: Story = {
  args: {
    section: keys[keys.length - 1],
    data: {
      ...BaseApplication,
      questionnaireData: {
        ...BaseApplication.questionnaireData,
        // Mark all non-review sections as completed
        sections: keys.slice(0, keys.length - 1).map((s) => ({ name: s, status: "Completed" })),
      },
    },
  },
  render: (args) => <ProgressBar section={args.section} />,
};

export const ReviewCompletedForApprovedApp: Story = {
  args: {
    section: keys[0],
    data: {
      ...BaseApplication,
      status: "Approved",
      questionnaireData: {
        ...BaseApplication.questionnaireData,
        sections: keys.slice(0, keys.length - 1).map((s) => ({ name: s, status: "Completed" })),
      },
    },
  },
  render: (args) => <ProgressBar section={args.section} />,
};

export const ReviewAndSubmitVisibleForSubmitter: Story = {
  args: {
    section: keys[0],
    user: {
      _id: "some-admin",
      role: "Admin",
      permissions: ["submission_request:view", "submission_request:submit"],
    },
    data: {
      ...BaseApplication,
      status: "In Progress",
      questionnaireData: {
        ...BaseApplication.questionnaireData,
        sections: keys.slice(0, keys.length - 1).map((s) => ({ name: s, status: "Completed" })),
      },
    },
  },
  render: (args) => <ProgressBar section={args.section} />,
};

export const ReviewOnlyVisibleWhenNoSubmitPermission: Story = {
  args: {
    section: keys[0],
    user: {
      _id: "viewer-only",
      role: "Admin",
      permissions: ["submission_request:view"],
    },
    data: {
      ...BaseApplication,
      status: "In Review",
      questionnaireData: {
        ...BaseApplication.questionnaireData,
        sections: keys.slice(0, keys.length - 1).map((s) => ({ name: s, status: "Completed" })),
      },
    },
  },
  render: (args) => <ProgressBar section={args.section} />,
};
