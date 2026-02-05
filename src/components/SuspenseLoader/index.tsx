import { Box, BoxProps, CircularProgress, styled } from "@mui/material";
import { ComponentProps, FC } from "react";

type Props = {
  /**
   * Defines whether the loader should be fullscreen or not.
   *
   * @default true
   */
  fullscreen?: boolean;
  /**
   * Defines the zIndex of the entire suspense loader.
   */
  zIndex?: BoxProps["zIndex"];
} & ComponentProps<typeof CircularProgress>;

const StyledBox = styled(Box, {
  shouldForwardProp: (p) => p !== "fullscreen",
})<Props>(({ fullscreen }) => ({
  position: fullscreen ? "fixed" : "absolute",
  background: "#fff",
  left: 0,
  top: 0,
  width: "100%",
  height: "100%",
}));

const SuspenseLoader: FC<Props> = ({ fullscreen = true, zIndex = 2000, ...rest }: Props) => (
  <StyledBox
    display="flex"
    alignItems="center"
    justifyContent="center"
    fullscreen={fullscreen}
    zIndex={zIndex}
  >
    <CircularProgress size={64} disableShrink thickness={3} aria-label="Content Loader" {...rest} />
  </StyledBox>
);

export default SuspenseLoader;
