import { Button, ButtonProps, styled } from "@mui/material";
import React from "react";

import StarIconSvg from "../assets/star-icon.svg?react";

type LogoVariant = "floating" | "square";

type StyledLogoButtonProps = {
  logoVariant?: LogoVariant;
  animated?: boolean;
} & Omit<ButtonProps, "variant">;

const StyledLogoButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== "logoVariant" && prop !== "animated",
})<StyledLogoButtonProps>(({ logoVariant = "square", animated = false, disabled = false }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "60px",
  height: "60px",
  minWidth: "60px",
  borderWidth: logoVariant === "floating" ? "2.25px 0px 2.25px 2.25px" : "2.25px",
  borderStyle: "solid",
  borderColor: "#FCF1F1",
  borderRadius: logoVariant === "floating" ? "15px 0px 0px 15px" : "15px",
  boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.4)",
  boxSizing: "border-box",
  overflow: "hidden",
  position: "relative",
  padding: 0,
  cursor: disabled ? "default" : "pointer",
  backgroundColor: "transparent",
  isolation: "isolate",
  transform: "translateZ(0)",
  "&::before": {
    content: '""',
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    transformOrigin: "center center",
    transform: `scale(1.5) rotate(${animated ? "180deg" : "0deg"})`,
    background: "linear-gradient(330.31deg, #663CFF 16.99%, #0146A2 58.31%, #37B6C9 93.35%)",
    transition: "transform 0.4s ease",
    backfaceVisibility: "hidden",
    willChange: "transform",
  },
  "& > *": {
    position: "relative",
    zIndex: 1,
  },
  ...(!disabled && {
    "&:hover::before": {
      transform: "scale(1.5) rotate(180deg)",
    },
  }),
  transition: "background 0.4s ease",
  "&.Mui-disabled": {
    borderColor: "#FCF1F1",
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.4)",
  },
  "&:hover": {
    backgroundColor: "transparent",
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.4)",
  },
}));

const StyledStarIcon = styled(StarIconSvg)({
  width: "35.5px",
  height: "35.5px",
});

export type ChatBotLogoProps = {
  /**
   * Variant of the logo:
   * - "square": All corners have border radius (default)
   * - "floating": Right corners have no border radius, no right border
   */
  variant?: "floating" | "square";
  /**
   * Whether the gradient should be in the animated (rotated) state
   */
  animated?: boolean;
  /**
   * Accessible label for the icon
   */
  ariaLabel?: string;
  /**
   * Click handler - when not provided, button is disabled
   */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

const ChatBotLogo = ({
  variant = "square",
  animated = false,
  ariaLabel,
  onClick,
}: ChatBotLogoProps): JSX.Element => (
  <StyledLogoButton
    logoVariant={variant}
    animated={animated}
    onClick={onClick}
    disabled={!onClick}
    aria-label={ariaLabel}
  >
    <StyledStarIcon />
  </StyledLogoButton>
);

export default React.memo<ChatBotLogoProps>(ChatBotLogo);
