import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import Dialog, { ErrorDetailsDialogV2Props } from "./index";

const meta = {
  title: "Dialogs / Error Details / V2",
  component: Dialog,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<ErrorDetailsDialogV2Props>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    preHeader: "Dialog Pre-Title",
    header: "Error Details",
    postHeader: "For Mock Node: #943841984",
    issues: [
      {
        severity: "error",
        message:
          "[file-final.tsv:line 2] “WXS” is not a permissable value for property “experimental_strategy_and_data_subtypes”.",
        action: <button type="button">Request new PV</button>,
      },
      {
        severity: "error",
        message: "Related node “program” [“program_acronym”: “CPTAC”] not found.",
      },
      {
        severity: "warning",
        message:
          "[errors-diagnosis.tsv:line 8] “diagnosis”: “study_diagnosis_id: AMD-DX-10006” : already exists and will be updated.",
      },
    ],
    onClose: fn(),
  },
};

export const LongList: Story = {
  ...Default,
  args: {
    ...Default.args,
    issues: Array.from({ length: 20 }, (_, idx) => ({
      severity: idx % 3 === 0 ? "error" : "warning",
      message:
        idx % 3 === 0
          ? `This is a mock issue for ${idx + 1}. `.repeat(6)
          : `This is a mock issue message number ${idx + 1}.`,
    })),
  },
};
