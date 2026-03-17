import { East } from "@mui/icons-material";
import { Box, IconButton, InputAdornment, styled } from "@mui/material";
import React, { useCallback } from "react";

import StyledOutlinedInput from "@/components/StyledFormComponents/StyledOutlinedInput";

import chatConfig from "../config/chatConfig";
import { useChatDrawerContext } from "../context/ChatDrawerContext";

const StyledBox = styled(Box, {
  shouldForwardProp: (prop) => prop !== "isFullscreen",
})<{ isFullscreen?: boolean }>(({ isFullscreen }) => ({
  position: "relative",
  zIndex: 2,
  padding: "15px 14px",
  ...(isFullscreen && {
    position: "sticky",
    bottom: 0,
    background: "linear-gradient(180deg, rgba(201, 229, 248, 0) 0%, #C9E5F8 20%)",
    marginTop: "auto",
  }),
}));

const StyledTextField = styled(StyledOutlinedInput)({
  "&.MuiOutlinedInput-root": {
    borderRadius: "8px",
    border: "0 !important",
  },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline, &:hover .MuiOutlinedInput-notchedOutline, & .MuiOutlinedInput-notchedOutline":
    {
      border: "1px solid #1545B5",
    },
  "& .MuiInputBase-input": {
    padding: "10px 15px",
    fontFamily: "Inter",
    fontStyle: "normal",
    fontWeight: 600,
    fontSize: "15px",
    lineHeight: "22px",
    color: "#3D4143",
  },
  "& .MuiInputBase-input::placeholder": {
    fontFamily: "Inter",
    fontStyle: "normal",
    fontWeight: 600,
    fontSize: "15px",
    lineHeight: "22px",
    color: "#727272",
    opacity: 1,
  },
});

const StyledSendButton = styled(IconButton)({
  padding: "0 !important",
  "&:hover": {
    backgroundColor: "transparent !important",
  },
  "&.Mui-disabled": {
    opacity: "0.4 !important",
  },
});

const SendIconCircle = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto",
  width: "28px",
  height: "28px",
  boxShadow: "inset 0px 4px 4px rgba(0, 0, 0, 0.25)",
  filter: "drop-shadow(0px 2px 2px rgba(0, 0, 0, 0.08))",
  background:
    "linear-gradient(326.08deg, #000000 5.77%, #000000 17.25%, #191919 62.29%, #FFFFFF 81.7%)",
  border: "0.75px solid #FBD9D9",
  borderRadius: "35px",
});

const StyledArrowIcon = styled(East)({
  color: "#FFFFFF !important",
  fontSize: "20px !important",
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
  const { isFullscreen } = useChatDrawerContext();
  /**
   * Handles input value changes and propagates them to the parent.
   */
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const newValue = event.target.value;
      if (newValue.length <= chatConfig.maxInputTextLength) {
        onChange(newValue);
      }
    },
    [onChange]
  );

  return (
    <StyledBox isFullscreen={isFullscreen}>
      <StyledTextField
        size="small"
        placeholder="Type your message..."
        value={value}
        onChange={handleInputChange}
        onKeyDown={onKeyDown}
        inputProps={{ "aria-label": "Type your message..." }}
        fullWidth
        endAdornment={
          <InputAdornment position="end">
            <StyledSendButton onClick={onSend} disabled={isSendDisabled} aria-label="Send message">
              <SendIconCircle>
                <StyledArrowIcon />
              </SendIconCircle>
            </StyledSendButton>
          </InputAdornment>
        }
      />
    </StyledBox>
  );
};

export default React.memo<Props>(ChatComposer);
