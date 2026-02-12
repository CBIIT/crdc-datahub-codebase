import { Box, Button, styled } from "@mui/material";
import { FC, memo, useState } from "react";

import { hasPermission } from "../../config/AuthPermissions";
import { useAuthContext } from "../Contexts/AuthContext";
import { InstitutionProvider } from "../Contexts/InstitutionListContext";
import StyledTooltip from "../StyledFormComponents/StyledTooltip";

import FormDialog from "./FormDialog";

const StyledBox = styled(Box)({
  marginLeft: "42px",
  marginBottom: "1px",
});

const StyledButton = styled(Button)({
  margin: 0,
  color: "#0B7F99",
  textTransform: "uppercase",
  fontSize: "13px",
  fontFamily: "Public Sans",
  fontWeight: "600",
  letterSpacing: "1.5",
  textDecoration: "underline !important",
  textUnderlineOffset: "2px",
  "&:hover": {
    backgroundColor: "transparent",
  },
});

const MemoizedProvider = memo(InstitutionProvider);

/**
 * A component to handle profile-based role change requests.
 *
 * @returns {React.ReactNode} A Request Access button and dialog.
 */
const AccessRequest: FC = (): React.ReactNode => {
  const { user } = useAuthContext();

  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  const handleClick = () => {
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
  };

  if (!hasPermission(user, "access", "request")) {
    return null;
  }

  return (
    <>
      <StyledBox>
        <StyledTooltip
          title="Request role change, study access, or institution update."
          placement="top"
          arrow
        >
          <span>
            <StyledButton
              variant="text"
              onClick={handleClick}
              data-testid="request-access-button"
              disableFocusRipple
              disableRipple
            >
              Request Access
            </StyledButton>
          </span>
        </StyledTooltip>
      </StyledBox>
      {dialogOpen && (
        <MemoizedProvider filterInactive>
          <FormDialog open onClose={handleClose} />
        </MemoizedProvider>
      )}
    </>
  );
};

export default memo(AccessRequest);
