import type { Meta, StoryObj } from "@storybook/react";

import { Roles } from "../../../config/AuthRoles";
import { HeaderLinks } from "../../../config/HeaderConfig";
import { Context as AuthContext, ContextState as AuthCtxState } from "../../Contexts/AuthContext";

import NavbarDesktopDropdown from "./NavbarDesktopDropdown";

const HeaderTitles =
  HeaderLinks?.filter((link) => "columns" in link).map((link) => link.name) || [];

const meta: Meta<typeof NavbarDesktopDropdown> = {
  title: "Navigation / Header / Dropdown",
  component: NavbarDesktopDropdown,
  parameters: {
    layout: "fullscreen",
    docs: {
      story: {
        inline: false,
        iframeHeight: 300,
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof NavbarDesktopDropdown>;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Without links",
  args: {},
  decorators: [
    (Story) => (
      <AuthContext.Provider value={{ isLoggedIn: false } as AuthCtxState}>
        <Story />
      </AuthContext.Provider>
    ),
  ],
};

export const DropdownExpanded: Story = {
  name: "Expanded",
  args: {
    role: "Admin",
    permissions: [
      "dashboard:view",
      "data_submission:create",
      "user:manage",
      "program:manage",
      "study:manage",
      "institution:manage",
    ],
    clickedTitle: HeaderTitles[0],
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
      options: [
        "dashboard:view",
        "data_submission:create",
        "user:manage",
        "program:manage",
        "study:manage",
        "institution:manage",
      ],
      control: {
        type: "check",
      },
    },
    HeaderLinks: {
      control: false,
      description: "The header sub-navigation links",
    },
    clickedTitle: {
      name: "Clicked Title",
      options: HeaderTitles,
      control: {
        type: "radio",
      },
      description: "The title of the navigation item clicked",
    },
  },
  decorators: [
    (Story, context) => (
      <AuthContext.Provider
        value={
          {
            isLoggedIn: true,
            user: {
              _id: "example-user",
              firstName: "Example",
              role: context.args.role,
              permissions: context.args.permissions,
            } as User,
          } as AuthCtxState
        }
      >
        <Story />
      </AuthContext.Provider>
    ),
  ],
};

export default meta;
