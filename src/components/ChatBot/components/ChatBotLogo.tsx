import { Button, ButtonProps, GlobalStyles, styled } from "@mui/material";
import React from "react";

import ChatBotLogoSvg from "../assets/chatbot-logo.svg?react";

const GradientProperties = () => (
  <GlobalStyles
    styles={`
      :root {
        --cb-gradient-duration: 0.3s;
        --cb-width-duration: 0.5s;

        --cb-start-angle: 330.31deg;
        --cb-start-stop-1: 16.99%;
        --cb-start-stop-2: 58.31%;
        --cb-start-stop-3: 93.35%;
        --cb-start-color-1: #663CFF;
        --cb-start-color-2: #0146A2;
        --cb-start-color-3: #37B6C9;

        --cb-end-angle: 330.31deg;
        --cb-end-stop-1: 3.81%;
        --cb-end-stop-2: 30.9%;
        --cb-end-stop-3: 79.46%;
        --cb-end-color-1: #37B6C9;
        --cb-end-color-2: #0146A2;
        --cb-end-color-3: #663CFF;
      }

      @property --gradient-angle {
        syntax: "<angle>";
        inherits: false;
        initial-value: 330.31deg;
      }
      @property --gradient-stop-1 {
        syntax: "<percentage>";
        inherits: false;
        initial-value: 16.99%;
      }
      @property --gradient-stop-2 {
        syntax: "<percentage>";
        inherits: false;
        initial-value: 58.31%;
      }
      @property --gradient-stop-3 {
        syntax: "<percentage>";
        inherits: false;
        initial-value: 93.35%;
      }
      @property --gradient-color-1 {
        syntax: "<color>";
        inherits: false;
        initial-value: #663CFF;
      }
      @property --gradient-color-2 {
        syntax: "<color>";
        inherits: false;
        initial-value: #0146A2;
      }
      @property --gradient-color-3 {
        syntax: "<color>";
        inherits: false;
        initial-value: #37B6C9;
      }
    `}
  />
);

type StyledLogoButtonProps = {
  logoVariant?: "floating" | "square";
  animated?: boolean;
  expanded?: boolean;
} & Omit<ButtonProps, "variant">;

const StyledLogoButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== "logoVariant" && prop !== "animated" && prop !== "expanded",
})<StyledLogoButtonProps>(
  ({ logoVariant = "square", animated = false, expanded = false, disabled = false }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: logoVariant === "floating" ? "flex-start" : "center",
    width: logoVariant === "floating" ? "auto" : "72px",
    height: "60px",
    minWidth: logoVariant === "floating" ? "69px" : "72px",
    ...(logoVariant === "floating" && {
      maxWidth: expanded ? "400px" : "69px",
    }),
    padding: 0,
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
    isolation: "isolate",
    transform: "translateZ(0)",
    cursor: disabled ? "default" : "pointer",
    backgroundColor: "transparent",
    borderWidth: logoVariant === "floating" ? "2.25px 0px 2.25px 2.25px" : "2.25px",
    borderStyle: "solid",
    borderColor: "#FCF1F1",
    borderRadius: logoVariant === "floating" ? "35px 0px 0px 35px" : "15px",
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.4)",

    "--gradient-angle": animated ? "var(--cb-end-angle)" : "var(--cb-start-angle)",
    "--gradient-stop-1": animated ? "var(--cb-end-stop-1)" : "var(--cb-start-stop-1)",
    "--gradient-stop-2": animated ? "var(--cb-end-stop-2)" : "var(--cb-start-stop-2)",
    "--gradient-stop-3": animated ? "var(--cb-end-stop-3)" : "var(--cb-start-stop-3)",
    "--gradient-color-1": animated ? "var(--cb-end-color-1)" : "var(--cb-start-color-1)",
    "--gradient-color-2": "var(--cb-start-color-2)",
    "--gradient-color-3": animated ? "var(--cb-end-color-3)" : "var(--cb-start-color-3)",

    backgroundImage: `
    linear-gradient(
      var(--gradient-angle),
      var(--gradient-color-1) var(--gradient-stop-1),
      var(--gradient-color-2) var(--gradient-stop-2),
      var(--gradient-color-3) var(--gradient-stop-3)
    )
  `,
    ...(logoVariant === "floating" && {
      backgroundPosition: "left",
    }),
    transition: `
    --gradient-angle var(--cb-gradient-duration) linear,
    --gradient-stop-1 var(--cb-gradient-duration) linear,
    --gradient-stop-2 var(--cb-gradient-duration) linear,
    --gradient-stop-3 var(--cb-gradient-duration) linear,
    --gradient-color-1 var(--cb-gradient-duration) linear,
    --gradient-color-2 var(--cb-gradient-duration) linear,
    --gradient-color-3 var(--cb-gradient-duration) linear,
    max-width var(--cb-width-duration) ease-in-out
  `,

    "& svg": {
      width: logoVariant === "floating" ? "47px" : "auto",
      height: logoVariant === "floating" ? "37px" : "33px",
    },

    "& > *": {
      position: "relative",
      zIndex: 1,
    },

    ...(!disabled && {
      "&:hover": {
        "--gradient-angle": "var(--cb-end-angle)",
        "--gradient-stop-1": "var(--cb-end-stop-1)",
        "--gradient-stop-2": "var(--cb-end-stop-2)",
        "--gradient-stop-3": "var(--cb-end-stop-3)",
        "--gradient-color-1": "var(--cb-end-color-1)",
        "--gradient-color-2": "var(--cb-end-color-2)",
        "--gradient-color-3": "var(--cb-end-color-3)",
        backgroundColor: "transparent",
        boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.4)",
      },
    }),

    "&.Mui-disabled": {
      borderColor: "#FCF1F1",
      boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.4)",
    },
  })
);

const StyledIconArea = styled("div")({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  paddingLeft: "11.75px",
  paddingRight: "9px",
  paddingTop: "9.75px",
  paddingBottom: "8.75px",
});

export type ChatBotLogoProps = {
  /**
   * Variant of the logo:
   * - "square": All corners have border radius (default)
   * - "floating": Right corners have no border radius, no right border
   */
  variant?: "floating" | "square";
  /**
   * Whether the gradient should be in the animated end state
   */
  animated?: boolean;
  /**
   * Whether the button width is expanded to show children.
   * Only applies to the "floating" variant.
   */
  expanded?: boolean;
  /**
   * Accessible label for the icon
   */
  ariaLabel?: string;
  /**
   * Click handler - when not provided, button is disabled
   */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /**
   * Optional content rendered after the logo icon
   */
  children?: React.ReactNode;
};

const ChatBotLogo = ({
  variant = "square",
  animated = false,
  expanded = false,
  ariaLabel,
  onClick,
  children,
}: ChatBotLogoProps): JSX.Element => (
  <>
    <GradientProperties />
    <StyledLogoButton
      logoVariant={variant}
      animated={animated}
      expanded={expanded}
      onClick={onClick}
      disabled={!onClick}
      aria-label={ariaLabel}
    >
      {children ? (
        <>
          <StyledIconArea>
            <ChatBotLogoSvg />
          </StyledIconArea>
          {children}
        </>
      ) : (
        <ChatBotLogoSvg />
      )}
    </StyledLogoButton>
  </>
);

export default React.memo<ChatBotLogoProps>(ChatBotLogo);
