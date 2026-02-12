import { useMediaQuery } from "@mui/material";
import { FC, memo } from "react";

import FooterDesktop from "./FooterDesktop";
import FooterMobile from "./FooterMobile";
import FooterTablet from "./FooterTablet";

/**
 * Provides the footer component based on the screen size.
 *
 * @returns The footer component.
 */
const Footer: FC = () => {
  const tablet = useMediaQuery("(min-width: 768px) and (max-width: 1024px)");
  const mobile = useMediaQuery("(max-width: 767px)");

  if (mobile) {
    return <FooterMobile />;
  }

  if (tablet) {
    return <FooterTablet />;
  }

  return <FooterDesktop />;
};

export default memo<FC>(Footer);
