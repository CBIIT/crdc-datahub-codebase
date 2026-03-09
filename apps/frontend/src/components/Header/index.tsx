import { useMediaQuery } from "@mui/material";
import { useSnackbar } from "notistack";
import { useEffect } from "react";

import { useAuthContext } from "../Contexts/AuthContext";

import HeaderDesktop from "./components/HeaderDesktop";
import HeaderTabletAndMobile from "./components/HeaderTabletAndMobile";
import USABanner from "./components/USABanner";

const Header = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { error: authError } = useAuthContext();
  const tabletAndMobile = useMediaQuery("(max-width: 1024px)");

  useEffect(() => {
    if (!authError) {
      return;
    }

    enqueueSnackbar(
      typeof authError === "string" && authError?.length > 0
        ? authError
        : "An unknown error occurred during login",
      { variant: "error" }
    );
  }, [authError]);

  return (
    <header>
      <USABanner />
      {tabletAndMobile ? <HeaderTabletAndMobile /> : <HeaderDesktop />}
    </header>
  );
};

export default Header;
