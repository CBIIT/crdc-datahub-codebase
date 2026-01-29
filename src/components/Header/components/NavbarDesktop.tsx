import { ClickAwayListener, styled } from "@mui/material";
import { flatMap } from "lodash";
import { useSnackbar } from "notistack";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";

import { hasPermission, Permissions } from "../../../config/AuthPermissions";
import { ActionHandlers, ActionId, HeaderLinks } from "../../../config/HeaderConfig";
import { Logger } from "../../../utils";
import APITokenDialog from "../../APITokenDialog";
import { useAuthContext } from "../../Contexts/AuthContext";
import UploaderToolDialog from "../../UploaderToolDialog";

import NavbarDesktopDropdown from "./NavbarDesktopDropdown";

const Nav = styled("div")({
  top: 0,
  left: 0,
  width: "100%",
  background: "#ffffff",
  boxShadow: "-0.1px 6px 9px -6px rgba(0, 0, 0, 0.5)",
  zIndex: 11000,
  position: "relative",
  "& .dropdownContainer": {
    margin: "0 auto",
    position: "relative",
    width: "1400px",
  },
  "& .loggedInName": {
    color: "#007BBD",
    textAlign: "right",
    fontSize: "14px",
    fontFamily: "Poppins",
    fontStyle: "normal",
    fontWeight: 600,
    lineHeight: "normal",
    letterSpacing: "0.42px",
    textDecoration: "none",
    textTransform: "uppercase",
    padding: "10px 0",
    marginBottom: "4.5px",
    marginRight: "40px",
  },
  "& .invisible": {
    visibility: "hidden",
  },
});

const NavContainer = styled("div")({
  margin: "0 auto",
  maxWidth: "1400px",
  textAlign: "left",
  position: "relative",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "end",
  "#navbar-dropdown-name-container": {
    margin: 0,
  },
});

const UlContainer = styled("ul")({
  listStyle: "none",
  margin: 0,
  paddingTop: "17px",
  paddingLeft: "11px",
  display: "flex",
  width: "100%",
});

const LiSection = styled("li")({
  display: "inline-block",
  position: "relative",
  lineHeight: "50px",
  letterSpacing: "1px",
  textAlign: "center",
  transition: "all 0.3s ease-in-out",
  "& a": {
    color: "#585C65",
    textDecoration: "none",
  },
  "& .displayName": {
    color: "#007BBD",
    fontSize: "14px",
    lineHeight: "20px",
    padding: "10px 0",
    textAlign: "right",
    width: "fit-content",
  },
  "&.name-dropdown-li": {
    marginLeft: "auto",
    marginRight: "12px",
  },
  "&.login-button": {
    lineHeight: "48px",
  },
  "& .navTitle": {
    display: "block",
    color: "#585C65",
    fontFamily: "poppins",
    fontSize: "17px",
    fontWeight: 600,
    lineHeight: "40px",
    letterSpacing: "normal",
    textDecoration: "none",
    margin: "0 5px",
    padding: "0 8px",
    userSelect: "none",
    borderTop: "4px solid transparent",
    borderLeft: "4px solid transparent",
    borderRight: "4px solid transparent",
    height: "100%",
    "&:hover": {
      cursor: "pointer",
    },
  },
  "& .navText": {
    borderBottom: "4px solid transparent",
    width: "fit-content",
    height: "100%",
    margin: "auto",
    "&:hover": {
      cursor: "pointer",
      color: "#3A75BD",
      borderBottom: "4px solid #3A75BD",
      "&::after": {
        content: '""',
        display: "inline-block",
        width: "6px",
        height: "6px",
        borderBottom: "1px solid #298085",
        borderLeft: "1px solid #298085",
        margin: "0 0 4px 8px",
        transform: "rotate(-45deg)",
        WebkitTransform: "rotate(-45deg)",
      },
    },
    "&::after": {
      content: '""',
      display: "inline-block",
      width: "6px",
      height: "6px",
      borderBottom: "1px solid #585C65",
      borderLeft: "1px solid #585C65",
      margin: "0 0 4px 8px",
      transform: "rotate(-45deg)",
      WebkitTransform: "rotate(-45deg)",
    },
  },
  "& .clicked": {
    color: "#FFFFFF",
    background: "#1F4671",
    "&::after": {
      borderTop: "1px solid #FFFFFF",
      borderRight: "1px solid #FFFFFF",
      borderBottom: "0",
      borderLeft: "0",
      margin: "0 0 0 8px",
    },
    "&:hover": {
      borderBottom: "4px solid #1F4671",
      color: "#FFFFFF",
      "&::after": {
        content: '""',
        display: "inline-block",
        width: "6px",
        height: "6px",
        borderTop: "1px solid #FFFFFF",
        borderRight: "1px solid #FFFFFF",
        borderBottom: "0",
        borderLeft: "0",
        margin: "0 0 0 8px",
        transform: "rotate(-45deg)",
        WebkitTransform: "rotate(-45deg)",
      },
    },
  },
  "& .directLink::after": {
    display: "none",
  },
  "& .directLink:hover::after": {
    display: "none",
  },
  "& .shouldBeUnderlined": {
    borderBottom: "4px solid #3A75BD !important",
  },
  "& .navTitleClicked": {
    display: "block",
    color: "#FFFFFF",
    fontFamily: "poppins",
    fontSize: "17px",
    fontWeight: 600,
    lineHeight: "40px",
    letterSpacing: "normal",
    textDecoration: "none",
    margin: "0 5px",
    padding: "0 8px",
    userSelect: "none",
    background: "#1F4671",
    borderTop: "4px solid #5786FF",
    borderLeft: "4px solid #5786FF",
    borderRight: "4px solid #5786FF",
    height: "100%",
    "& .shouldBeUnderlined": {
      borderBottom: "0 !important",
    },
  },
  "& .invisible": {
    visibility: "hidden",
  },
});

const StyledLoginLink = styled(Link)({
  color: "#007BBD !important",
  textAlign: "right",
  fontSize: "14px",
  fontFamily: "Poppins",
  fontStyle: "normal",
  fontWeight: 600,
  lineHeight: "normal",
  letterSpacing: "0.42px",
  textDecoration: "none",
  textTransform: "uppercase",
  padding: "10px 0",
  marginBottom: "4.5px",
  marginRight: "32px",
});

const useOutsideAlerter = (ref1: React.RefObject<HTMLDivElement>) => {
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        !event.target ||
        (event.target.getAttribute("class") !== "dropdownList" &&
          ref1.current &&
          !ref1.current.contains(event.target))
      ) {
        const toggle = document.getElementsByClassName("navText clicked");
        if (toggle[0] && !event.target.getAttribute("class")?.includes("navText clicked")) {
          const temp: HTMLElement = toggle[0] as HTMLElement;
          temp.click();
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref1]);
};

const NavBar = () => {
  const { isLoggedIn, user, logout } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();

  const [clickedTitle, setClickedTitle] = useState("");
  const [openAPITokenDialog, setOpenAPITokenDialog] = useState<boolean>(false);
  const [uploaderToolOpen, setUploaderToolOpen] = useState<boolean>(false);
  const [restorePath, setRestorePath] = useState<string>(null);
  const dropdownSelection = useRef<HTMLDivElement>(null);

  const clickableObject = HeaderLinks.filter(
    (item) => item.className === "navMobileItem clickable"
  );
  const clickableTitle = clickableObject.map((item) => item.name) as string[];
  const displayName = user?.firstName?.toUpperCase() || "N/A";

  clickableTitle.push(displayName);

  const handleLogout = async () => {
    setClickedTitle("");
    const logoutStatus = await logout();
    if (logoutStatus) {
      navigate("/");
      enqueueSnackbar("You have been logged out.", { variant: "success" });
    }
  };

  const actionHandlers: ActionHandlers = useMemo(
    () => ({
      logout: handleLogout,
      openAPITokenDialog: () => setOpenAPITokenDialog(true),
      openCLIToolDialog: () => setUploaderToolOpen(true),
    }),
    [logout]
  );

  const handleItemClick = (item: ActionId) => {
    if (!item) {
      Logger.error(`NavbarDesktop.tsx: No action found for actionId '${item}'`);
      return;
    }

    actionHandlers[item]?.();
  };

  const handleMenuClick = (e) => {
    if (e.target.textContent === clickedTitle || !clickableTitle.includes(e.target.textContent)) {
      setClickedTitle("");
    } else {
      setClickedTitle(e.target.textContent);
    }
  };

  const handleUserClick = () => {
    setClickedTitle("User");
  };

  const onKeyPressHandler = (e) => {
    if (e.key === "Enter") {
      handleMenuClick(e);
    }
  };

  const shouldBeUnderlined = (item) => {
    const linkName = item.name;
    const correctPath = window.location.pathname;
    if (item.className === "navMobileItem") {
      return correctPath === item.link;
    }
    const tab = HeaderLinks.find((link) => link.name === linkName);
    if (!tab) {
      return false;
    }

    if ("columns" in tab) {
      // Current path is within sub-navigation links
      const linkNames = flatMap(tab.columns).map((item) => item.link);
      return linkNames.includes(correctPath);
    }

    return false;
  };

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

  useOutsideAlerter(dropdownSelection);

  useEffect(() => {
    if (!isLoggedIn) {
      setClickedTitle("");
    }
  }, [isLoggedIn]);

  useEffect(() => {
    setClickedTitle("");
  }, []);

  useEffect(() => {
    if (!location?.pathname || location?.pathname === "/") {
      setRestorePath(null);
      return;
    }

    setRestorePath(location?.pathname);
  }, [location]);

  const headerLinksWithoutUser = useMemo(
    () => HeaderLinks.filter((headerLinks) => headerLinks.name !== "User"),
    [HeaderLinks]
  );

  return (
    <ClickAwayListener onClickAway={() => setClickedTitle("")}>
      <Nav>
        <NavContainer>
          <UlContainer>
            {headerLinksWithoutUser?.map((navItem: NavBarItem) => {
              const hasEveryPermission = checkPermissions(navItem.permissions);
              if (!hasEveryPermission) {
                return null;
              }

              return (
                <LiSection key={navItem.id}>
                  {navItem.className === "navMobileItem" ? (
                    <div className="navTitle directLink">
                      <NavLink
                        to={navItem.link}
                        target={navItem.link.startsWith("https://") ? "_blank" : "_self"}
                      >
                        <div
                          id={navItem.id}
                          role="button"
                          tabIndex={0}
                          className={`navText directLink ${
                            shouldBeUnderlined(navItem) ? "shouldBeUnderlined" : ""
                          }`}
                          onKeyDown={onKeyPressHandler}
                          onClick={handleMenuClick}
                        >
                          {navItem.name}
                        </div>
                      </NavLink>
                    </div>
                  ) : (
                    <div className={clickedTitle === navItem.name ? "navTitleClicked" : "navTitle"}>
                      <div
                        id={navItem.id}
                        role="button"
                        tabIndex={0}
                        className={`${
                          clickedTitle === navItem.name ? "navText clicked" : "navText"
                        } ${shouldBeUnderlined(navItem) ? "shouldBeUnderlined" : ""}`}
                        onKeyDown={onKeyPressHandler}
                        onClick={handleMenuClick}
                      >
                        {navItem.name}
                      </div>
                    </div>
                  )}
                </LiSection>
              );
            })}
            <LiSection className={`name-dropdown-li${isLoggedIn ? "" : " login-button"}`}>
              {isLoggedIn ? (
                <div
                  id="navbar-dropdown-name-container"
                  className={clickedTitle === "User" ? "navTitleClicked" : "navTitle"}
                >
                  <div
                    id="navbar-dropdown-name"
                    role="button"
                    tabIndex={0}
                    className={
                      clickedTitle === "User"
                        ? "navText displayName clicked"
                        : "navText displayName"
                    }
                    onKeyDown={onKeyPressHandler}
                    onClick={handleUserClick}
                  >
                    {displayName}
                  </div>
                </div>
              ) : (
                <StyledLoginLink
                  id="header-navbar-login-button"
                  to="/login"
                  state={{ redirectState: restorePath }}
                >
                  Login
                </StyledLoginLink>
              )}
            </LiSection>
          </UlContainer>
        </NavContainer>
        <NavbarDesktopDropdown
          clickedTitle={clickedTitle}
          onTitleClick={(title) => setClickedTitle(title)}
          onItemClick={(item) => handleItemClick(item)}
        />
        <APITokenDialog open={openAPITokenDialog} onClose={() => setOpenAPITokenDialog(false)} />
        <UploaderToolDialog open={uploaderToolOpen} onClose={() => setUploaderToolOpen(false)} />
      </Nav>
    </ClickAwayListener>
  );
};

export default NavBar;
