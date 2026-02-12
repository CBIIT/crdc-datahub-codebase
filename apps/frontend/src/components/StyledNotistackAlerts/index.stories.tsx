import { Stack, Typography } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react";
import { useSnackbar, VariantType } from "notistack";
import { useEffect, useRef } from "react";

/**
 * Demo component that displays a snackbar based on Storybook controls
 */
const SnackbarDemo = ({ message, variant }: { message: string; variant: VariantType }) => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const prevId = useRef<string | number | null>(null);

  useEffect(() => {
    if (message) {
      closeSnackbar(prevId.current);
      prevId.current = enqueueSnackbar(message, { variant, persist: true });
    }
  }, [message, variant, enqueueSnackbar]);

  return (
    <Stack justifyContent="center" alignItems="center" height="100vh" spacing={2} padding={2}>
      <Typography variant="body1">
        Use the controls panel to change the snackbar message and variant.
      </Typography>
    </Stack>
  );
};

const meta: Meta<typeof SnackbarDemo> = {
  title: "Miscellaneous / Notistack",
  component: SnackbarDemo,
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["default", "success", "error"],
      description: "The variant of the snackbar notification",
    },
    message: {
      control: { type: "text" },
      description: "The message to display in the snackbar",
    },
  },
} satisfies Meta<typeof SnackbarDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default variant snackbar example
 */
export const Default: Story = {
  args: {
    message: "This is a default notification message",
    variant: "default",
  },
};

/**
 * Success variant snackbar example
 */
export const Success: Story = {
  args: {
    message: "Operation completed successfully!",
    variant: "success",
  },
};

/**
 * Error variant snackbar example
 */
export const Error: Story = {
  args: {
    message: "An error occurred while processing your request",
    variant: "error",
  },
};

export const LongMessage: Story = {
  args: {
    message: `This is a very long notification message intended to test how the snackbar handles overflow and text wrapping. https://www.example.com/this/is/a/very/long/url/that/should/test/overflow/and/wrapping/in/the/snackbar/component It should display properly without breaking the layout or causing any visual issues.`,
    variant: "default",
  },
};
