import { Alert, AlertColor, AlertProps, styled } from "@mui/material";
import React, { FC, useEffect, useState } from "react";

const StyledAlert = styled(Alert, {
  shouldForwardProp: (prop) => prop !== "bgColor",
})(({ bgColor }: { bgColor?: string }) => ({
  color: "#ffffff",
  backgroundColor: bgColor || "#5D53F6",
  width: "535px",
  boxSizing: "border-box",
  minHeight: "50px",
  borderColor: bgColor || "none",
  boxShadow: "-4px 8px 27px 4px rgba(27,28,28,0.09)",
  justifyContent: "center",
  zIndex: "1400",
  position: "fixed",
  top: "20px",
  left: "50%",
  transform: "translateX(-50%)",
  userSelect: "none",
}));

export type AlertState = {
  message: string;
  severity: AlertColor;
};

type Props = {
  open: boolean;
  severity?: AlertProps["severity"];
  children: React.ReactNode;
};

/**
 * Basic alert component that can be used to display a message to the user.
 *
 * @deprecated DO NOT USE. Replaced by `enqueueSnackbar` from Notistack.
 */
const GenericAlert: FC<Props> = ({ open, children, severity = "success" }: Props) => {
  const [bgColor, setBgColor] = useState<string>(null);

  useEffect(() => {
    let newBgColor;
    switch (severity) {
      case "success":
        newBgColor = "#5D53F6";
        break;
      case "error":
        newBgColor = "#E74040";
        break;
      default:
        newBgColor = "#5D53F6";
        break;
    }

    setBgColor(newBgColor);
  }, [severity]);

  if (!open) return null;

  return (
    <StyledAlert severity={severity} bgColor={bgColor} icon={false}>
      {children}
    </StyledAlert>
  );
};

export default GenericAlert;
