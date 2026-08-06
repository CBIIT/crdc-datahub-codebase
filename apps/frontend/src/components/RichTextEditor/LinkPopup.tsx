import CloseIcon from "@mui/icons-material/Close";
import { Box, Button, IconButton, Link, Popover, Typography, styled } from "@mui/material";
import type { KeyboardEvent, ReactElement } from "react";

import StyledHelperText from "@/components/StyledFormComponents/StyledHelperText";
import StyledOutlinedInput from "@/components/StyledFormComponents/StyledOutlinedInput";

import type { LinkPopupController, LinkPopupMode } from "./hooks/useLinkPopup";

const StyledPopupContent = styled(Box)({
  width: "320px",
  padding: "16px",
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
});

const StyledPopupHeader = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});

const StyledPopupActions = styled(Box)({
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
});

const StyledLinkUrl = styled(Link)({
  wordBreak: "break-all",
});

type Props = {
  popup: LinkPopupController;
};

/**
 * Gets the popup title for the current mode.
 *
 * @param {LinkPopupMode} mode - The current popup mode.
 * @param {boolean} isExistingLink - Whether the popup targets an existing link.
 * @returns {string} The popup title.
 */
const getPopupTitle = (mode: LinkPopupMode, isExistingLink: boolean): string => {
  if (mode === "view") {
    return "Link";
  }

  if (isExistingLink) {
    return "Edit link";
  }

  return "Add link";
};

/**
 * The popup used to add, view, edit, and remove links in the rich text editor.
 *
 * @returns {JSX.Element}
 */
const LinkPopup = ({ popup }: Props): ReactElement => {
  const { open, mode, anchorElement, text, url, error, linkPath } = popup?.state || {};
  const isExistingLink = linkPath !== null;

  const handleUrlKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    popup.save();
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorElement}
      onClose={popup.close}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      disableRestoreFocus
      TransitionProps={{ onExited: popup.resetAfterClose }}
      data-testid="rich-text-link-popup"
    >
      <StyledPopupContent role="dialog" aria-label="Link details">
        {mode === "edit" && (
          <StyledPopupHeader>
            <Typography variant="subtitle1" fontWeight={600}>
              {getPopupTitle(mode, isExistingLink)}
            </Typography>
            <IconButton
              size="small"
              aria-label="Close"
              onClick={popup.close}
              data-testid="rich-text-link-popup-close"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </StyledPopupHeader>
        )}
        {mode === "view" && (
          <IconButton
            size="small"
            aria-label="Close"
            onClick={popup.close}
            data-testid="rich-text-link-popup-close"
            sx={{ position: "absolute", top: 8, right: 8 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}

        {mode === "view" && (
          <>
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {text}
              </Typography>
              <StyledLinkUrl
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                data-testid="rich-text-link-popup-url"
              >
                {url}
              </StyledLinkUrl>
            </Box>

            <StyledPopupActions>
              <Button
                size="small"
                variant="contained"
                color="info"
                onClick={popup.remove}
                data-testid="rich-text-link-popup-remove"
              >
                Remove
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={popup.startEditing}
                data-testid="rich-text-link-popup-edit"
              >
                Edit
              </Button>
            </StyledPopupActions>
          </>
        )}

        {mode === "edit" && (
          <>
            <Box>
              <Typography variant="body2" fontWeight={600} mb="4px">
                Text
              </Typography>
              <StyledOutlinedInput
                size="small"
                fullWidth
                autoFocus
                value={text}
                onChange={(event) => popup.setText(event.target.value)}
                inputProps={{ "data-testid": "rich-text-link-popup-text-input" }}
              />
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={600} mb="4px">
                Link
              </Typography>
              <StyledOutlinedInput
                size="small"
                fullWidth
                value={url}
                error={error !== ""}
                onChange={(event) => popup.setUrl(event.target.value)}
                onKeyDown={handleUrlKeyDown}
                inputProps={{ "data-testid": "rich-text-link-popup-url-input" }}
              />
              <StyledHelperText>{error ? "Please enter a valid URL" : " "}</StyledHelperText>
            </Box>

            <StyledPopupActions>
              <Button
                size="small"
                variant="contained"
                color="info"
                onClick={popup.close}
                data-testid="rich-text-link-popup-cancel"
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={popup.save}
                data-testid="rich-text-link-popup-save"
              >
                Save
              </Button>
            </StyledPopupActions>
          </>
        )}
      </StyledPopupContent>
    </Popover>
  );
};

export default LinkPopup;
