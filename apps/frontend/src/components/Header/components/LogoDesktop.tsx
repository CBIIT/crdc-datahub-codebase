import { styled } from "@mui/material";
import React from "react";
import { Link } from "react-router-dom";

import { headerData } from "../../../config/HeaderConfig";

const LogoArea = styled("div")({
  display: "flex",
  "& img": {
    width: "fit-content",
    height: "56px",
    maxWidth: "100%",
  },
  "& .logoContainer": {
    marginTop: "35px",
    maxWidth: "440px",
  },
});

const Logo = () => (
  <LogoArea>
    <Link id="header-logo-home-link" className="logoContainer" to={headerData.globalHeaderLogoLink}>
      <img src={headerData.globalHeaderLogo} alt={headerData.globalHeaderLogoAltText} />
    </Link>
  </LogoArea>
);

export default Logo;
