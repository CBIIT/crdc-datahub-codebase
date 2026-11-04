import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, waitFor, within, expect } from "@storybook/test";

import {
  DataModelsProvider,
  MANIFEST_CACHE_KEY,
} from "../../components/Contexts/DataModelsContext";
import ErrorBoundary from "../../components/ErrorBoundary";
import env from "../../env";

import NavigatorView from "./NavigatorView";

type CustomStoryProps = React.ComponentProps<typeof NavigatorView> & {
  model: string;
  version?: string;
  tier?: AppEnv["VITE_DEV_TIER"];
};

const meta: Meta<CustomStoryProps> = {
  title: "Pages / Model Navigator",
  component: NavigatorView,
  args: {},
  argTypes: {
    model: {
      control: "select",
      description: "The display name of the Data Model to display",
      options: ["GC", "CCDI", "CTDC", "ICDC", "PSDC", "SDM"],
    },
    version: {
      control: "text",
      description: "The version of the model to display",
    },
    tier: {
      control: "select",
      description: "The deployment tier",
      options: ["dev", "dev2", "qa", "qa2", "stage", "prod"],
    },
  },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story, context) => {
      try {
        // Remove the cached model manifest
        localStorage.removeItem(MANIFEST_CACHE_KEY);

        // Set the dev tier to fetch the correct manifest from
        env.VITE_DEV_TIER = context.args.tier;
      } catch (e) {
        /* empty */
      }

      return (
        <ErrorBoundary key={`${context.args.tier}-${context.args.model}-${context.args.version}`}>
          <DataModelsProvider>
            <Story />
          </DataModelsProvider>
        </ErrorBoundary>
      );
    },
  ],
} satisfies Meta<CustomStoryProps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ModelNavigatorGraph: Story = {
  name: "Graph View",
  args: {
    model: "GC",
    version: "9.0.0",
    tier: "dev",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const graphTab = await canvas.findByText("Graph View");
    await userEvent.click(graphTab);

    await waitFor(() => {
      expect(graphTab.closest("button")).toHaveAttribute("aria-selected", "true");
    });
  },
};

export const ModelNavigatorTable: Story = {
  name: "Table View",
  args: {
    model: "GC",
    version: "9.0.0",
    tier: "dev",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tableTab = await canvas.findByText("Table View");
    await userEvent.click(tableTab);

    await waitFor(() => {
      expect(tableTab.closest("button")).toHaveAttribute("aria-selected", "true");
    });
  },
};

export const ModelNavigatorVersionHistory: Story = {
  name: "Version History View",
  args: {
    model: "GC",
    version: "9.0.0",
    tier: "dev",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const versionTab = await canvas.findByText("Version History");
    await userEvent.click(versionTab);

    await waitFor(() => {
      expect(versionTab.closest("button")).toHaveAttribute("aria-selected", "true");
    });
  },
};
