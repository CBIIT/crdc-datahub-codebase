import { styled } from "@mui/material";

import Logo from "./LogoDesktop";
import NavBar from "./NavbarDesktop";

const HeaderBanner = styled("div")({
  width: "100%",
});

const HeaderContainer = styled("div")({
  margin: "0 auto",
  paddingLeft: "32px",
  paddingRight: "32px",
  maxWidth: "1400px",
  display: "flex",
});

const Header = () => (
  <HeaderBanner data-testid="navigation-header-desktop">
    <HeaderContainer>
      <Logo />
    </HeaderContainer>
    <div className="navbarContainer">
      <NavBar />
    </div>
  </HeaderBanner>
);

export default Header;
