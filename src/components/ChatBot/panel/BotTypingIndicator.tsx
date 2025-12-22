import { Box, Stack, Typography, styled } from "@mui/material";
import React from "react";

import chatConfig from "../chatConfig";

const TypingSender = styled(Typography)({
  fontSize: "12px",
  fontWeight: 500,
  color: "rgba(0,0,0,0.7)",
  paddingInline: "4px",
  marginBottom: "4px",
});

const TypingBubble = styled(Box)({
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  paddingInline: "14px",
  paddingBlock: "10px",
  minHeight: "36px",
  borderRadius: "12px",
  backgroundColor: "#F5F5F5",
});

const TypingDot = styled("span")({
  "--dot-size": "10px",
  "--dot-border-width": "1px",
  "--dot-border-color": "rgba(0, 94, 162, 0.28)",
  "--dot-color-1": "#005EA2",
  "--dot-color-2": "#2B78B3",
  "--dot-color-3": "#5A99C8",
  "--animation-duration": "1200ms",
  "--animation-delay-step": "260ms",

  width: "var(--dot-size)",
  height: "var(--dot-size)",
  borderRadius: "50%",
  display: "block",
  boxSizing: "border-box",
  backgroundColor: "transparent",
  border: "var(--dot-border-width) solid var(--dot-border-color)",
  animationName: "typingDotSweep",
  animationDuration: "var(--animation-duration)",
  animationIterationCount: "infinite",
  animationTimingFunction: "ease-in-out",

  "@keyframes typingDotSweep": {
    "0%": {
      backgroundColor: "var(--dot-color)",
      borderColor: "transparent",
    },
    "24%": {
      backgroundColor: "var(--dot-color)",
      borderColor: "transparent",
    },
    "34%": {
      backgroundColor: "transparent",
      borderColor: "var(--dot-border-color)",
    },
    "100%": {
      backgroundColor: "transparent",
      borderColor: "var(--dot-border-color)",
    },
  },

  "&:nth-of-type(1)": {
    ["--dot-color" as string]: "var(--dot-color-1)",
    animationDelay: "0ms",
  },
  "&:nth-of-type(2)": {
    ["--dot-color" as string]: "var(--dot-color-2)",
    animationDelay: "var(--animation-delay-step)",
  },
  "&:nth-of-type(3)": {
    ["--dot-color" as string]: "var(--dot-color-3)",
    animationDelay: "calc(var(--animation-delay-step) * 2)",
  },
});

export type Props = {
  /**
   * The name of the bot sender to display. Defaults to the configured support bot name.
   */
  senderName?: string;
};

/**
 * Displays an animated typing indicator with the bot's name and three animated dots.
 */
const BotTypingIndicator = ({ senderName = chatConfig.supportBotName }: Props): JSX.Element => (
  <Stack direction="row" justifyContent="flex-start" marginBottom="12px">
    <Stack direction="column" alignItems="flex-start">
      <TypingSender>{senderName}</TypingSender>

      <TypingBubble aria-label={`${senderName} is typing`}>
        <TypingDot />
        <TypingDot />
        <TypingDot />
      </TypingBubble>
    </Stack>
  </Stack>
);

export default React.memo<Props>(BotTypingIndicator);
