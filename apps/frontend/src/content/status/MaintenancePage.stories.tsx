import type { Meta, StoryObj } from "@storybook/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";

import MaintenancePage from "./MaintenancePage";

const mockRouter = createMemoryRouter(
  [
    {
      path: "/",
      element: <MaintenancePage />,
    },
  ],
  {
    initialEntries: [{ pathname: "/", state: { data: { shouldBlock: true } } }],
  }
);

const meta: Meta = {
  title: "Pages / Maintenance Page",
  // Workaround because useBlocker requires a data router, so
  // we need to render the mock router instead
  component: () => <RouterProvider router={mockRouter} />,
  parameters: {
    layout: "fullscreen",
    router: {
      useGlobalRouter: false, // Disable the global router decorator
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Maintenance Page",
};
