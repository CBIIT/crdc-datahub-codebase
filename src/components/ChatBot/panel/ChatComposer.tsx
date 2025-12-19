import SendIcon from "@mui/icons-material/Send";
import { Box, IconButton, Stack, styled } from "@mui/material";
import React, { useCallback } from "react";

import StyledOutlinedInput from "@/components/StyledFormComponents/StyledOutlinedInput";

const StyledBox = styled(Box)({
  borderTop: "1px solid rgba(0,0,0,0.12)",
  padding: "12px",
  backgroundColor: "#FFFFFF",
});

const StyledTextField = styled(StyledOutlinedInput)({
  "&.MuiOutlinedInput-root": {
    borderRadius: "8px",
    border: "0 !important",
  },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    border: "1px solid #005EA2",
  },
  "& .MuiInputBase-input": {
    fontSize: "14px",
    padding: "10px",
  },
});

const StyledSendButton = styled(IconButton)({
  backgroundColor: "#005EA2",
  color: "#FFFFFF",
  borderRadius: "8px",
  width: "40px",
  height: "40px",
  "&:hover": {
    backgroundColor: "#115293",
  },
  "&.Mui-disabled": {
    backgroundColor: "rgba(0,0,0,0.12)",
    color: "rgba(0,0,0,0.26)",
  },
});

export type Props = {
  /**
   * The current value of the input field.
   */
  value: string;
  /**
   * Callback fired when the input value changes.
   */
  onChange: (value: string) => void;
  /**
   * Callback fired when the send button is clicked.
   */
  onSend: () => void;
  /**
   * Callback fired on keyboard events in the input field.
   */
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  /**
   * Indicates whether the send button should be disabled.
   */
  isSendDisabled: boolean;
};

/**
 * Input field and send button for composing and sending chat messages.
 */
const ChatComposer = ({
  value,
  onChange,
  onSend,
  onKeyDown,
  isSendDisabled,
}: Props): JSX.Element => {
  /**
   * Handles input value changes and propagates them to the parent.
   */
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      onChange(event.target.value);
    },
    [onChange]
  );

  return (
    <StyledBox>
      <Stack direction="row" gap="8px">
        <StyledTextField
          size="small"
          placeholder="Type a message..."
          value={value}
          onChange={handleInputChange}
          onKeyDown={onKeyDown}
          inputProps={{ "aria-label": "Type a message" }}
          fullWidth
        />
        <StyledSendButton onClick={onSend} disabled={isSendDisabled} aria-label="Send message">
          <SendIcon fontSize="small" />
        </StyledSendButton>
      </Stack>
    </StyledBox>
  );
};

export default React.memo<Props>(ChatComposer);
