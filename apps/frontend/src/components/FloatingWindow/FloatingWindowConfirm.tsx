import { Button, Typography, styled } from "@mui/material";
import React from "react";

import { useFloatingWindowContext } from "./FloatingWindowContext";

const ConfirmOverlay = styled("div")({
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "18px 36px !important",
  backgroundColor: "#E3E9F2 !important",
  border: "2px solid #2982D7 !important",
  borderRadius: "10px !important",
  zIndex: 3,
  '&[data-fullscreen="true"], &[data-expanded="true"]': {
    border: "none !important",
    borderRadius: "0 !important",
  },
});

const ConfirmTitle = styled(Typography)({
  fontFamily: "Inter !important",
  fontStyle: "normal",
  fontWeight: "500 !important",
  fontSize: "15px !important",
  lineHeight: "22px !important",
  textAlign: "center !important" as never,
  color: "#334B5A !important",
  marginTop: "30px !important",
});

const ConfirmActions = styled("div")({
  display: "flex",
  gap: "12px !important",
  justifyContent: "center !important",
  marginTop: "30px !important",
});

const StyledBaseButton = styled(Button)({
  fontFamily: "Nunito, sans-serif !important",
  fontSize: "0.875rem !important",
  lineHeight: "1.75 !important",
  letterSpacing: "normal !important",
  display: "flex !important",
  justifyContent: "center !important",
  alignItems: "center !important",
  color: "#FFF !important",
  borderRadius: "8px !important",
  textTransform: "none !important" as never,
  textAlign: "center !important" as never,
  zIndex: 3,
  "&.Mui-disabled": {
    "&.MuiButton-containedPrimary": {
      fontWeight: "700 !important",
      color: "#FFF !important",
      border: "1.5px solid #08596C !important",
      background: "#1A8199 !important",
      opacity: "0.4 !important",
    },
    "&.MuiButton-containedError": {
      fontWeight: "700 !important",
      color: "#FFF !important",
      border: "1.5px solid #6C2110 !important",
      background: "#B34C36 !important",
      opacity: "0.4 !important",
    },
    "&.MuiButton-containedInfo": {
      fontWeight: "700 !important",
      color: "#EDEDED !important",
      background: "#B1B1B1 !important",
      border: "1.5px solid #6B7294 !important",
    },
    "& .MuiButton-startIcon, & .MuiButton-endIcon": {
      color: "#EDEDED !important",
    },
  },
  "&.MuiButton-containedInfo": {
    color: "#000 !important",
  },
  "& .MuiButton-startIcon": {
    position: "absolute !important" as never,
    left: "11px !important",
    color: "#6B7294 !important",
  },
  "& .MuiButton-endIcon": {
    position: "absolute !important" as never,
    right: "11px !important",
    color: "#6B7294 !important",
  },
});

const StyledPrimaryButton = styled(StyledBaseButton)({
  border: "1.5px solid #08596C !important",
  fontWeight: "700 !important",
  background: "#1A8199 !important",
  "&:hover": {
    border: "1.5px solid #08596C !important",
    background: "#1A8199 !important",
    backgroundImage: "linear-gradient(rgb(0 0 0/15%) 0 0) !important",
  },
});

const StyledInfoButton = styled(StyledBaseButton)({
  border: "1.5px solid #6B7294 !important",
  fontWeight: "700 !important",
  background: "white !important",
  "&:hover": {
    border: "1.5px solid #6B7294 !important",
    background: "#C0DAF3 !important",
  },
});

export type Props = {
  /**
   * The confirmation title.
   */
  title: string;
  /**
   * Optional icon or logo rendered above the title.
   */
  icon?: React.ReactNode;
  /**
   * Label for the confirm button.
   *
   * @default "Yes"
   */
  confirmLabel?: string;
  /**
   * Label for the cancel button.
   *
   * @default "No"
   */
  cancelLabel?: string;
};

/**
 * Confirmation overlay shown inside a FloatingWindow before it closes.
 */
const FloatingWindowConfirm = ({
  title,
  icon,
  confirmLabel = "Yes",
  cancelLabel = "No",
}: Props): JSX.Element => {
  const { isExpanded, isFullscreen, onConfirmClose, onCancelClose } = useFloatingWindowContext();

  return (
    <ConfirmOverlay
      role="alertdialog"
      aria-label={title}
      data-expanded={String(isExpanded)}
      data-fullscreen={String(isFullscreen)}
    >
      {icon}
      <ConfirmTitle>{title}</ConfirmTitle>

      <ConfirmActions>
        <StyledPrimaryButton
          variant="contained"
          color="primary"
          onClick={(e) => {
            e.stopPropagation();
            onConfirmClose();
          }}
          aria-label={confirmLabel}
        >
          {confirmLabel}
        </StyledPrimaryButton>

        <StyledInfoButton
          variant="contained"
          color="info"
          onClick={(e) => {
            e.stopPropagation();
            onCancelClose();
          }}
          aria-label={cancelLabel}
        >
          {cancelLabel}
        </StyledInfoButton>
      </ConfirmActions>
    </ConfirmOverlay>
  );
};

export default React.memo<Props>(FloatingWindowConfirm);
