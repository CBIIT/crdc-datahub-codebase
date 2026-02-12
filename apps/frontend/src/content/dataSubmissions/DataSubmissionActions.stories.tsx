import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { fn, userEvent, within, expect, screen, waitFor } from "@storybook/test";
import { ComponentPropsWithoutRef } from "react";

import { submissionAttributesFactory } from "@/factories/submission/SubmissionAttributesFactory";
import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import {
  Context as AuthContext,
  ContextState as AuthCtxState,
} from "../../components/Contexts/AuthContext";
import {
  SubmissionContext,
  SubmissionCtxStatus,
} from "../../components/Contexts/SubmissionContext";
import { Roles } from "../../config/AuthRoles";

import DataSubmissionActions from "./DataSubmissionActions";

const dataSubmissionPermissions: DataSubmissionPermissions[] = [
  "data_submission:view",
  "data_submission:create",
  "data_submission:review",
  "data_submission:admin_submit",
  "data_submission:confirm",
  "data_submission:cancel",
];

const submissionStatuses: SubmissionStatus[] = [
  "New",
  "In Progress",
  "Canceled",
  "Submitted",
  "Withdrawn",
  "Rejected",
  "Released",
  "Completed",
  "Deleted",
];

const validationStatuses: (ValidationStatus | null)[] = [
  null,
  "Validating",
  "New",
  "Error",
  "Passed",
  "Warning",
];

type ContextArgs = {
  role: UserRole;
  permissions: DataSubmissionPermissions[];
  submissionStatus: SubmissionStatus;
  metadataValidationStatus: ValidationStatus | null;
  fileValidationStatus: ValidationStatus | null;
  dataType: SubmissionDataType;
  intention: SubmissionIntention;
  dataFileSize: number;
  hasOrphanError: boolean;
  isBatchUploading: boolean;
  dataCommonsDisplayName: string;
};

type ComponentProps = ComponentPropsWithoutRef<typeof DataSubmissionActions>;

type StoryArgs = ContextArgs & ComponentProps;

const withProviders: Decorator<StoryArgs> = (Story, context) => {
  const {
    role,
    permissions,
    submissionStatus,
    metadataValidationStatus,
    fileValidationStatus,
    dataType,
    intention,
    dataFileSize,
    hasOrphanError = false,
    isBatchUploading = false,
    dataCommonsDisplayName,
  } = context.args;

  return (
    <AuthContext.Provider
      value={
        {
          isLoggedIn: true,
          user: {
            _id: "example-user",
            firstName: "Example",
            role,
            permissions,
          } as User,
        } as AuthCtxState
      }
    >
      <SubmissionContext.Provider
        value={submissionCtxStateFactory.build({
          status: SubmissionCtxStatus.LOADING,
          error: null,
          startPolling: fn(),
          stopPolling: fn(),
          refetch: fn(),
          updateQuery: fn(),
          data: {
            getSubmission: submissionFactory.build({
              _id: "submission-1",
              submitterID: "example-user",
              crossSubmissionStatus: "New",
              status: submissionStatus,
              metadataValidationStatus,
              fileValidationStatus,
              dataCommonsDisplayName,
              dataType,
              intention,
              dataFileSize: {
                formatted: "",
                size: dataFileSize,
              },
            }),
            getSubmissionAttributes: {
              submissionAttributes: submissionAttributesFactory
                .pick(["hasOrphanError", "isBatchUploading"])
                .build({
                  hasOrphanError,
                  isBatchUploading,
                }),
            },
            submissionStats: null,
          },
        })}
      >
        <Story />
      </SubmissionContext.Provider>
    </AuthContext.Provider>
  );
};

const meta = {
  title: "Data Submissions / Actions",
  component: DataSubmissionActions,
  parameters: {
    layout: "centered",
  },
  decorators: [withProviders],
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
      options: dataSubmissionPermissions,
      control: {
        type: "check",
      },
    },
    submissionStatus: {
      name: "Status",
      options: submissionStatuses,
      control: {
        type: "radio",
      },
    },
    metadataValidationStatus: {
      name: "metadataValidationStatus",
      options: validationStatuses,
      control: {
        type: "radio",
      },
    },
    fileValidationStatus: {
      name: "fileValidationStatus",
      options: validationStatuses,
      control: {
        type: "radio",
      },
    },
    dataType: {
      name: "dataType",
      options: ["Metadata and Data Files", "Metadata Only"],
      control: {
        type: "radio",
      },
    },
    intention: {
      name: "intention",
      options: ["New/Update", "Delete"],
      control: {
        type: "radio",
      },
    },
    dataFileSize: {
      name: "dataFileSize",
      control: {
        type: "number",
      },
    },
    hasOrphanError: {
      name: "hasOrphanError",
      control: {
        type: "boolean",
      },
    },
    isBatchUploading: {
      name: "isBatchUploading",
      control: {
        type: "boolean",
      },
    },
    dataCommonsDisplayName: {
      name: "dataCommonsDisplayName",
      control: {
        type: "text",
      },
    },
  },
  args: {
    role: "Submitter",
    permissions: ["data_submission:view", "data_submission:create", "data_submission:cancel"],
    submissionStatus: "In Progress",
    metadataValidationStatus: "Passed",
    fileValidationStatus: "Passed",
    dataType: "Metadata and Data Files",
    intention: "New/Update",
    dataFileSize: 1000,
    hasOrphanError: false,
    isBatchUploading: false,
    dataCommonsDisplayName: "DC-1",
    onAction: fn(),
  },
  tags: ["autodocs"],
} satisfies Meta<StoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SubmissionShouldNotBeNewStatus: Story = {
  name: "Submission should not be 'New' status",
  args: { submissionStatus: "New" },
};

export const MetadataValidationShouldBeInitializedForDeleteIntention: Story = {
  name: "Metadata validation should be initialized for 'Delete' intention",
  args: { intention: "Delete", metadataValidationStatus: null },
};

export const MetadataValidationShouldBeInitializedForMetadataOnlySubmissions: Story = {
  name: "Metadata validation should be initialized for 'Metadata Only' submissions",
  args: { dataType: "Metadata Only", metadataValidationStatus: null },
};

export const DataFileSizeShouldBeGreaterThan0ForMetadataAndDataFileSubmissions: Story = {
  name: "Data file size should be greater than 0 for 'Metadata and Data Files' submissions",
  args: { dataType: "Metadata and Data Files", fileValidationStatus: null, dataFileSize: 0 },
};

export const MetadataValidationShouldBeInitializedForMetadataAndDataFilesSubmissions: Story = {
  name: "Metadata validation should be initialized for 'Metadata and Data Files' submissions",
  args: { dataType: "Metadata and Data Files", metadataValidationStatus: null },
};

export const MetadataAndDataFileShouldNotHaveNewStatus: Story = {
  name: "Metadata and Data File should not have 'New' status",
  args: { metadataValidationStatus: "New", fileValidationStatus: "New" },
};

export const SubmissionShouldNotHaveOrphanedFiles: Story = {
  name: "Submission should not have orphaned files",
  args: {
    hasOrphanError: true,
  },
};

export const ValidationShouldNotCurrentlyBeRunning: Story = {
  name: "Validation should not currently be running",
  args: { metadataValidationStatus: "Validating", fileValidationStatus: "Validating" },
};

export const BatchesShouldNotBeUploading: Story = {
  name: "No Batches should have 'Uploading' status",
  args: { isBatchUploading: true },
};

export const ThereShouldBeNoValidationErrorsForMetadataOrDataFiles: Story = {
  name: "There should be no validation errors for metadata or data files",
  args: { metadataValidationStatus: "Error", fileValidationStatus: "Error" },
};

export const AdminOverrideSubmissionHasValidationErrors: Story = {
  name: "Admin Override - Submission has validation errors",
  args: {
    metadataValidationStatus: "Error",
    fileValidationStatus: "Error",
    role: "Admin",
    permissions: [
      "data_submission:view",
      "data_submission:create",
      "data_submission:cancel",
      "data_submission:admin_submit",
    ],
  },
};

export const AdminCanPerformRegularSubmitWithAdminSubmitPermissions: Story = {
  name: "Admin can perform regular submit with 'admin_submit' permissions",
  args: {
    role: "Admin",
    permissions: ["data_submission:view", "data_submission:cancel", "data_submission:admin_submit"],
  },
};

export const UserIsMissingSubmitPermissions: Story = {
  name: "User is missing 'data_submission:create' and 'data_submission:admin_submit' permissions",
  args: {
    role: "Admin",
    permissions: ["data_submission:view", "data_submission:review", "data_submission:cancel"],
  },
};

export const Withdraw: Story = {
  name: "User can Withdraw their submitted submission",
  args: {
    submissionStatus: "Submitted",
  },
  play: async ({ canvasElement }) => {
    const { getByRole } = within(canvasElement);
    const withdrawBtn = getByRole("button", { name: /withdraw/i });

    expect(withdrawBtn).toBeEnabled();

    userEvent.hover(withdrawBtn);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });
  },
};

export const Release: Story = {
  name: "User with 'data_submission:review' permission can Release a submitted submission",
  args: {
    role: "Admin",
    permissions: ["data_submission:view", "data_submission:review"],
    submissionStatus: "Submitted",
  },
};

export const Complete: Story = {
  name: "User with 'data_submission:confirm' permission can Complete a released submission",
  args: {
    role: "Admin",
    permissions: ["data_submission:view", "data_submission:confirm"],
    submissionStatus: "Released",
  },
};

export const Completed: Story = {
  name: "No actions are shown once a submission is completed",
  args: {
    role: "Admin",
    permissions: ["data_submission:view", "data_submission:confirm", "data_submission:confirm"],
    submissionStatus: "Completed",
  },
};
