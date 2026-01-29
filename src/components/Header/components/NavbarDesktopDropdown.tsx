import { Button, styled } from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2";
import { Link } from "react-router-dom";

import { hasPermission, Permissions } from "../../../config/AuthPermissions";
import { ActionId, HeaderLinks } from "../../../config/HeaderConfig";
import { Status, useAuthContext } from "../../Contexts/AuthContext";
import SuspenseLoader from "../../SuspenseLoader";

const Dropdown = styled("div")({
  left: 0,
  right: 0,
  width: "100%",
  background: "#1F4671",
  zIndex: 11000,
  display: "block",
  position: "absolute",
  paddingTop: "35px",
  paddingBottom: "12px",
  "&.invisible": {
    visibility: "hidden",
  },
});

const StyledGridContainer = styled(Grid)({
  margin: "0 auto",
  textAlign: "left",
  position: "relative",
  maxWidth: "1400px",
  padding: "0 16px",
  "& .dropdownList": {
    padding: 0,
    marginTop: 0,
    marginBottom: "45px",
    listStyle: "none",
  },
  "& .gridItem": {
    paddingLeft: "12px",
    paddingRight: "12px",
  },
  "& .dropdownListItem": {
    padding: 0,
    margin: 0,
    lineHeight: "22px",
    height: "22px",
  },
  "& .dropdownItem": {
    padding: "0",
    textAlign: "left",
    fontFamily: "'Poppins', sans-serif",
    fontStyle: "normal",
    fontWeight: 600,
    fontSize: "20px",
    lineHeight: "22px",
    color: "#FFFFFF",
    textDecoration: "none",
    cursor: "pointer",
    whiteSpace: "pre-line",
    "&:hover": {
      textDecoration: "underline",
    },
  },
  "& a.dropdownItem": {
    display: "inline-block",
    padding: "0",
  },
  "& .dropdownItemButton": {
    textTransform: "none",
    paddingLeft: 0,
    "&:hover": {
      background: "transparent",
    },
  },
  "#navbar-dropdown-item-name-logout": {
    maxWidth: "200px",
  },
});

type Props = {
  clickedTitle: string;
  onTitleClick?: (title: string) => void;
  onItemClick?: (item: ActionId) => void;
};

const NavbarDesktopDropdown = ({ clickedTitle, onTitleClick, onItemClick }: Props) => {
  const { user, status: AuthStatus } = useAuthContext();

  const checkPermissions = (permissions: AuthPermissions[]) => {
    if (!permissions?.length) {
      return true; // No permissions required
    }

    return permissions.every((permission) => {
      const [entityRaw, actionRaw] = permission.split(":", 2);

      if (!entityRaw || !actionRaw) {
        return false;
      }

      const entity = entityRaw as keyof Permissions;
      const action = actionRaw as Permissions[keyof Permissions]["action"];

      return hasPermission(user, entity, action, null, true);
    });
  };

  if (AuthStatus === Status.LOADING) {
    return <SuspenseLoader />;
  }

  const dropdownLinks: NavBarItem | undefined = HeaderLinks.find(
    (link) => link.name === clickedTitle
  );

  // Get completely empty columns due to insufficient permissions
  const emptyColumns =
    dropdownLinks?.columns?.filter(
      (c) => c.some((r) => r.permissions) && c.every((r) => !checkPermissions(r.permissions || []))
    ) || [];

  return (
    <Dropdown className={clickedTitle === "" ? "invisible" : ""}>
      <StyledGridContainer container>
        {clickedTitle !== ""
          ? dropdownLinks?.columns?.map((column, columnIdx) => {
              if (!column?.length || emptyColumns.includes(column)) {
                return null;
              }

              return (
                // eslint-disable-next-line react/no-array-index-key
                <Grid xs={3} key={`column-${columnIdx}`}>
                  {column.map((dropItem, rowIdx) => {
                    const hasEveryPermission = checkPermissions(dropItem?.permissions);
                    if (!hasEveryPermission) {
                      // eslint-disable-next-line react/no-array-index-key
                      return <Grid xs={3} key={`empty-${columnIdx}-${rowIdx}`} />;
                    }

                    if (dropItem.link) {
                      return (
                        <Grid xs={3} key={dropItem.id} className="gridItem">
                          <ul className="dropdownList">
                            <li className="dropdownListItem">
                              <Link
                                target={
                                  dropItem.link.startsWith("https://") ||
                                  dropItem.link.endsWith(".pdf")
                                    ? "_blank"
                                    : "_self"
                                }
                                id={dropItem.id}
                                to={dropItem.link}
                                className="dropdownItem"
                                onClick={() => onTitleClick("")}
                              >
                                {dropItem.name}
                                {dropItem.text && (
                                  <div className="dropdownItemText">{dropItem.text}</div>
                                )}
                              </Link>
                            </li>
                          </ul>
                        </Grid>
                      );
                    }

                    return (
                      <Grid xs={3} key={dropItem.id} className="gridItem">
                        <ul className="dropdownList">
                          <li className="dropdownListItem">
                            <Button
                              id={dropItem.id}
                              key={dropItem.id}
                              className="dropdownItem dropdownItemButton"
                              onClick={() => onItemClick?.(dropItem.actionId as ActionId)}
                            >
                              {dropItem.name}
                            </Button>
                          </li>
                        </ul>
                      </Grid>
                    );
                  })}
                </Grid>
              );
            })
          : null}
      </StyledGridContainer>
    </Dropdown>
  );
};

export default NavbarDesktopDropdown;
