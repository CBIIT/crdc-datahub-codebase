import Logo from "../assets/header/Portal_Logo.svg";
import LogoSmall from "../assets/header/Portal_Logo_Small.svg";
import usaFlagSmall from "../assets/header/us_flag_small.svg";

import { DataCommons } from "./DataCommons";

export const SubmissionRequestInstructionsLink =
  "https://datacommons.cancer.gov/submission-request-instructions";

export const DataSubmissionInstructionsLink =
  "https://datacommons.cancer.gov/data-submission-instructions";

export const DataExplorerInstructionsLink =
  "https://datacommons.cancer.gov/data-explorer-instructions";

// globalHeaderLogo image 468x100
// globalHeaderImage: image 2200x100
export const headerData = {
  globalHeaderLogo: Logo,
  globalHeaderLogoSmall: LogoSmall,
  globalHeaderLogoLink: "/",
  globalHeaderLogoAltText: "Portal Logo",
  usaFlagSmall,
  usaFlagSmallAltText: "usaFlagSmall",
};

export const HeaderLinks = [
  {
    name: "Back to CRDC",
    link: "https://datacommons.cancer.gov/submit",
    id: "navbar-dropdown-join-crdc-data-hub",
    className: "navMobileItem",
  },
  {
    name: "Submission Requests",
    link: "/submission-requests",
    id: "navbar-dropdown-submission-requests",
    className: "navMobileItem",
  },
  {
    name: "Data Submissions",
    link: "/data-submissions",
    id: "navbar-dropdown-data-submissions",
    className: "navMobileItem",
  },
  {
    name: "Data Explorer",
    link: "/data-explorer",
    id: "navbar-dropdown-data-explorer",
    className: "navMobileItem",
  },
  {
    name: "Documentation",
    link: "#",
    id: "navbar-dropdown-documentation",
    className: "navMobileItem clickable",
    columns: [
      [
        {
          name: "Submission Request Instructions",
          link: SubmissionRequestInstructionsLink,
          id: "submission-request-instructions",
          className: "navMobileSubItem",
        },
      ],
      [
        {
          name: "Data Submission\nInstructions",
          link: DataSubmissionInstructionsLink,
          id: "data-submission-instructions",
          className: "navMobileSubItem",
        },
      ],
      [
        {
          name: "Data Explorer\nInstructions",
          link: DataExplorerInstructionsLink,
          id: "data-explorer-instructions",
          className: "navMobileSubItem",
        },
      ],
      [
        {
          name: "API Instructions",
          link: "/CRDC_Data_Submission_API_Instructions.pdf",
          id: "api-instructions",
          className: "navMobileSubItem",
        },
      ],
    ],
  },
  {
    name: "Model Navigator",
    link: "#",
    id: "navbar-dropdown-model-navigator",
    className: "navMobileItem clickable",
    columns: DataCommons.map((dc) => [
      {
        id: `model-navigator-${dc.name}`,
        name: `${dc.displayName}${dc.displayName.indexOf("Model") === -1 ? " Model" : ""}`,
        link: `/model-navigator/${dc.displayName}/latest`,
        className: "navMobileSubItem",
      },
    ]),
  },

  {
    name: "User",
    id: "navbar-dropdown-user",
    className: "navMobileItem clickable",
    columns: [
      [
        {
          name: "Uploader CLI Tool",
          id: "navbar-dropdown-item-uploader-tool",
          className: "navMobileSubItem action",
          actionId: "openCLIToolDialog",
        },
        {
          name: "API Token",
          id: "navbar-dropdown-item-api-token",
          className: "navMobileSubItem action",
          permissions: ["data_submission:create"],
          actionId: "openAPITokenDialog",
        },
      ],
      [
        {
          name: "Operation Dashboard",
          link: "/operation-dashboard",
          id: "navbar-dropdown-operation-dashboard",
          className: "navMobileSubItem",
          permissions: ["dashboard:view"],
        },
        {
          name: "Manage Studies",
          link: "/studies",
          id: "navbar-dropdown-item-studies-manage",
          className: "navMobileSubItem",
          permissions: ["study:manage"],
        },
        {
          name: "Manage Programs",
          link: "/programs",
          id: "navbar-dropdown-item-program-manage",
          className: "navMobileSubItem",
          permissions: ["program:manage"],
        },
        {
          name: "Manage Institutions",
          link: "/institutions",
          id: "navbar-dropdown-item-institution-manage",
          className: "navMobileSubItem",
          permissions: ["institution:manage"],
        },
        {
          name: "Manage Users",
          link: "/users",
          id: "navbar-dropdown-item-user-manage",
          className: "navMobileSubItem",
          permissions: ["user:manage"],
        },
      ],
      [
        {
          name: "User Profile",
          link: "/profile/:userId",
          id: "navbar-dropdown-item-user-profile",
          className: "navMobileSubItem",
        },
      ],
      [
        {
          name: "Logout",
          id: "navbar-dropdown-item-logout",
          className: "navMobileSubItem action",
          actionId: "logout",
        },
      ],
    ],
  },
] as const satisfies NavBarItem[];

/**
 * Type defining the actionId's defined within HeaderLinks
 *
 * @see HeaderLinks
 */
export type ActionId = Extract<
  Extract<(typeof HeaderLinks)[number], { columns: NavBarSubItem[][] }>["columns"][number][number],
  { actionId: string }
>["actionId"];

/**
 * Provides structure for the action handlers
 *
 * @see HeaderLinks
 */
export type ActionHandlers = { [key in ActionId]?: (...args) => unknown };
