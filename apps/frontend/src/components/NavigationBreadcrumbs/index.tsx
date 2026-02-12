import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { Breadcrumbs, styled, Typography } from "@mui/material";
import { FC, memo } from "react";
import { Link } from "react-router-dom";

const StyledBreadcrumbs = styled(Breadcrumbs)({
  textUnderlineOffset: "3px",
  width: "100%",
  "& .MuiBreadcrumbs-li:last-of-type": {
    minWidth: 0,
    flex: 1,
  },
  "& .MuiBreadcrumbs-separator": {
    color: "#71767A",
    marginLeft: "4px",
    marginRight: "4px",
  },
});

const StyledBreadcrumb = styled(Typography)({
  fontFamily: "Public Sans",
  fontWeight: 400,
  fontSize: "16px",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const StyledLink = styled(Link)({
  color: "inherit",
});

export type BreadcrumbEntry = {
  /**
   * The label to display for the breadcrumb
   */
  label: string;
  /**
   * The URL to navigate to when the breadcrumb is clicked
   *
   * If omitted, the breadcrumb will visually appear as a static item
   */
  to?: string;
};

export type NavigationBreadcrumbsProps = {
  /**
   * The entries to display in the breadcrumbs
   */
  entries: Array<BreadcrumbEntry>;
};

/**
 * A component that provides a standard implementation of navigational breadcrumbs. Supports:
 *
 * - Linking to a route
 * - Native CSS truncation of labels
 *
 * You must provide a container for the component. By default, there is no external margin or padding.
 *
 * @returns The navigation breadcrumbs component
 */
const NavigationBreadcrumbs: FC<NavigationBreadcrumbsProps> = ({ entries }) => (
  <StyledBreadcrumbs
    separator={<NavigateNextIcon />}
    aria-label="navigation breadcrumb"
    data-testid="breadcrumb-container"
  >
    {entries.map(({ label, to }, index) => (
      <StyledBreadcrumb
        key={label}
        color={to ? "#005EA2" : "#1B1B1B"}
        data-testid={`breadcrumb-entry-${index}`}
      >
        {to ? <StyledLink to={to}>{label}</StyledLink> : label}
      </StyledBreadcrumb>
    ))}
  </StyledBreadcrumbs>
);

export default memo<NavigationBreadcrumbsProps>(NavigationBreadcrumbs);
