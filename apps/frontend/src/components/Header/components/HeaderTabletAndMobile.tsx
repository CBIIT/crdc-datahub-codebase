import { styled } from "@mui/material";
import { flatMap } from "lodash";
import { useSnackbar } from "notistack";
import React, { HTMLProps, useEffect, useMemo, useState } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";

import leftArrowIcon from "../../../assets/header/Left_Arrow.svg?url";
import menuClearIcon from "../../../assets/header/Menu_Cancel_Icon.svg?url";
import rightArrowIcon from "../../../assets/header/Right_Arrow.svg?url";
import { hasPermission, Permissions } from "../../../config/AuthPermissions";
import { ActionHandlers, ActionId, HeaderLinks } from "../../../config/HeaderConfig";
import { Logger } from "../../../utils";
import APITokenDialog from "../../APITokenDialog";
import { useAuthContext } from "../../Contexts/AuthContext";
import UploaderToolDialog from "../../UploaderToolDialog";

import Logo from "./LogoMobile";

const HeaderBanner = styled("div")({
  width: "100%",
});

const HeaderContainer = styled("div")({
  margin: "0 auto",
  paddingLeft: "16px",
  boxShadow: "-0.1px 6px 9px -6px rgba(0, 0, 0, 0.5)",
  "& .headerLowerContainer": {
    display: "flex",
    margin: "16px 0 4px 0",
    height: "51px",
  },
  "& .menuButton": {
    width: "89px",
    height: "45px",
    background: "#1F4671",
    borderRadius: "5px",
    fontFamily: "Open Sans",
    fontWeight: 700,
    fontSize: "20px",
    lineHeight: "45px",
    color: "#FFFFFF",
    textAlign: "center",
    "&:hover": {
      cursor: "pointer",
    },
  },
});

const NavMobileContainer = styled("div", {
  shouldForwardProp: (prop) => prop !== "display",
})<HTMLProps<HTMLDivElement> & { display: string }>(({ display }) => ({
  display,
  position: "absolute",
  left: 0,
  top: 0,
  height: "100%",
  width: "100%",
  zIndex: 1200,
}));

const MenuArea = styled("div")({
  height: "100%",
  width: "100%",
  display: "flex",
  "& .menuContainer": {
    background: "#ffffff",
    width: "300px",
    height: "100%",
    padding: "21px 16px",
  },
  "& .greyContainer": {
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,.2)",
  },
  "& .closeIcon": {
    height: "14px",
    marginBottom: "29px",
  },
  "& .closeIconImg": {
    float: "right",
    "&:hover": {
      cursor: "pointer",
    },
  },
  "& .backButton": {
    fontFamily: "Open Sans",
    fontWeight: 600,
    fontSize: "16px",
    lineHeight: "16px",
    color: "#007BBD",
    paddingLeft: "16px",
    background: `url("${leftArrowIcon}") left no-repeat`,
    "&:hover": {
      cursor: "pointer",
    },
  },
  "& .navMobileContainer": {
    padding: "24px 0 0 0",
    "& a": {
      textDecoration: "none",
      color: "#3D4551",
    },
  },
  "& .navMobileItem": {
    width: "268px",
    padding: "8px 24px 8px 16px",
    fontFamily: "Open Sans",
    fontWeight: 400,
    fontSize: "16px",
    lineHeight: "16px",
    borderTop: "1px solid #F0F0F0",
    borderBottom: "1px solid #F0F0F0",
    color: "#3D4551",
    "&:hover": {
      backgroundColor: "#f9f9f7",
    },
  },
  "& .SubItem": {
    paddingLeft: "24px",
  },
  "& .clickable": {
    background: `url("${rightArrowIcon}") 90% no-repeat`,
    cursor: "pointer",
  },
  "& .action": {
    cursor: "pointer",
  },
});

const Header = () => {
  const { isLoggedIn, user, logout } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();

  const [navMobileDisplay, setNavMobileDisplay] = useState("none");
  const [openAPITokenDialog, setOpenAPITokenDialog] = useState<boolean>(false);
  const [uploaderToolOpen, setUploaderToolOpen] = useState<boolean>(false);
  const [selectedList, setSelectedList] = useState<NavBarItem[] | NavBarSubItem[]>(HeaderLinks);
  const [restorePath, setRestorePath] = useState<string | null>(null);

  const displayName = user?.firstName || "N/A";

  const handleLogout = async () => {
    const logoutStatus = await logout?.();
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
      Logger.error(`HeaderTabletAndMobile.tsx: No action found for actionId '${item}'`);
      return;
    }

    actionHandlers[item]?.();
  };

  const clickNavItem = (clickTitle: string) => {
    const list: NavBarItem = HeaderLinks?.find(
      (link) => link.name === clickTitle && "columns" in link
    );
    setSelectedList(flatMap(list?.columns));
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

  useEffect(() => {
    if (!location?.pathname || location?.pathname === "/") {
      setRestorePath(null);
      return;
    }

    setRestorePath(location?.pathname);
  }, [location]);

  return (
    <>
      <HeaderBanner data-testid="navigation-header-mobile">
        <HeaderContainer>
          <Logo />
          <div className="headerLowerContainer">
            <div
              role="button"
              id="header-navbar-open-menu-button"
              tabIndex={0}
              className="menuButton"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setNavMobileDisplay("block");
                }
              }}
              onClick={() => setNavMobileDisplay("block")}
            >
              Menu
            </div>
          </div>
        </HeaderContainer>
      </HeaderBanner>
      <NavMobileContainer display={navMobileDisplay}>
        <MenuArea>
          <div className="menuContainer">
            <div
              role="button"
              id="navbar-close-navbar-button"
              tabIndex={0}
              className="closeIcon"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setNavMobileDisplay("none");
                }
              }}
              onClick={() => setNavMobileDisplay("none")}
            >
              <img className="closeIconImg" src={menuClearIcon} alt="menuClearButton" />
            </div>
            {selectedList !== HeaderLinks && (
              <div
                role="button"
                id="navbar-back-to-main-menu-button"
                tabIndex={0}
                className="backButton"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSelectedList(HeaderLinks);
                  }
                }}
                onClick={() => setSelectedList(HeaderLinks)}
              >
                Main Menu
              </div>
            )}
            <div className="navMobileContainer">
              {selectedList
                ?.filter((headerLinks) => headerLinks.name !== "User")
                ?.map((navMobileItem: NavBarItem | NavBarSubItem) => {
                  const hasEveryPermission = checkPermissions(navMobileItem?.permissions);
                  if (!hasEveryPermission) {
                    return null;
                  }

                  return (
                    <React.Fragment key={`mobile_${navMobileItem.id}`}>
                      {navMobileItem.className === "navMobileItem" && (
                        <NavLink
                          id={navMobileItem.id}
                          to={navMobileItem.link}
                          target={navMobileItem.link.startsWith("https://") ? "_blank" : "_self"}
                          onClick={() => setNavMobileDisplay("none")}
                        >
                          <div className="navMobileItem">{navMobileItem.name}</div>
                        </NavLink>
                      )}
                      {navMobileItem.className === "navMobileItem clickable" && (
                        <div
                          id={navMobileItem.id}
                          role="button"
                          tabIndex={0}
                          className="navMobileItem clickable"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              clickNavItem(navMobileItem.name);
                            }
                          }}
                          onClick={() => clickNavItem(navMobileItem.name)}
                        >
                          {navMobileItem.name}
                        </div>
                      )}
                      {navMobileItem.className === "navMobileSubItem action" &&
                      "actionId" in navMobileItem &&
                      typeof navMobileItem.actionId === "string" ? (
                        <div
                          id={navMobileItem.id}
                          role="button"
                          tabIndex={0}
                          className="navMobileItem SubItem action"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleItemClick(navMobileItem.actionId as ActionId);
                            }
                          }}
                          onClick={() => handleItemClick(navMobileItem.actionId as ActionId)}
                        >
                          {navMobileItem.name}
                        </div>
                      ) : null}
                      {navMobileItem.className === "navMobileSubItem" && (
                        <Link
                          id={navMobileItem.id}
                          to={navMobileItem.link}
                          target={
                            navMobileItem.link.startsWith("https://") ||
                            navMobileItem.link.endsWith(".pdf")
                              ? "_blank"
                              : "_self"
                          }
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            className="navMobileItem SubItem"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                setNavMobileDisplay("none");
                                if (navMobileItem.name === "Logout") {
                                  handleLogout();
                                  setSelectedList(HeaderLinks);
                                }
                              }
                            }}
                            onClick={() => {
                              setNavMobileDisplay("none");
                              if (navMobileItem.name === "Logout") {
                                handleLogout();
                                setSelectedList(HeaderLinks);
                              }
                            }}
                          >
                            {navMobileItem.name}
                          </div>
                        </Link>
                      )}
                      {navMobileItem.className === "navMobileSubTitle" && (
                        <div className="navMobileItem">{navMobileItem.name}</div>
                      )}
                    </React.Fragment>
                  );
                })}
              {/* eslint-disable-next-line no-nested-ternary */}
              {selectedList === HeaderLinks ? (
                isLoggedIn ? (
                  <div
                    id="navbar-dropdown-name"
                    role="button"
                    tabIndex={0}
                    className="navMobileItem clickable"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        clickNavItem("User");
                      }
                    }}
                    onClick={() => clickNavItem("User")}
                  >
                    {displayName}
                  </div>
                ) : (
                  <Link id="navbar-link-login" to="/login" state={{ redirectState: restorePath }}>
                    <div
                      role="button"
                      tabIndex={0}
                      className="navMobileItem"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setNavMobileDisplay("none");
                        }
                      }}
                      onClick={() => setNavMobileDisplay("none")}
                    >
                      Login
                    </div>
                  </Link>
                )
              ) : null}
            </div>
          </div>
          <div
            role="button"
            id="navbar-close-navbar-grey-section"
            tabIndex={0}
            className="greyContainer"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setNavMobileDisplay("none");
              }
            }}
            onClick={() => setNavMobileDisplay("none")}
            aria-label="greyContainer"
          />
        </MenuArea>
        <APITokenDialog open={openAPITokenDialog} onClose={() => setOpenAPITokenDialog(false)} />
        <UploaderToolDialog open={uploaderToolOpen} onClose={() => setUploaderToolOpen(false)} />
      </NavMobileContainer>
    </>
  );
};

export default Header;
