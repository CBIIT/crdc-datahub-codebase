import { Box, Grid, Stack, SxProps, Typography, styled } from "@mui/material";
import React, { FC } from "react";

type Props = {
  /**
   * The index of the flow step.
   *
   * @note This is for visual purposes only. Do not use 0-based indexing.
   * @example 1
   */
  index: number;
  /**
   * Optional styling for the title container.
   */
  titleContainerSx?: SxProps;
  /**
   * The title of the flow step.
   *
   * @example "Upload Metadata"
   */
  title: string;
  /**
   * An optional adornment to display after the title.
   */
  titleAdornment?: React.ReactNode;
  /**
   * Whether this is the last flow step.
   * This is used to determine whether to display the bottom border
   *
   * @default false
   */
  last?: boolean;
  /**
   * The primary content of the flow step.
   */
  children: React.ReactNode;
  /**
   * Any action buttons to display at the end of the flow step.
   */
  actions?: React.ReactNode;
};

const StyledGrid = styled(Grid)({
  fontFamily: "Nunito",
  paddingTop: "9px",
});

const StyledRule = styled("hr")({
  border: "none",
  backgroundColor: "#D1D1D1",
  height: "1px",
  marginTop: "14px",
  marginBottom: "9px",
});

const StyledIndexGrid = styled(Grid)({
  width: "40px",
});

const StyledIndex = styled(Box)({
  width: "27px",
  height: "27px",
  borderRadius: "50%",
  border: "1px solid #26B893",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  color: "#0B6CB1",
  fontSize: "16px",
  fontWeight: 700,
});

const StyledPrimaryGrid = styled(Grid)({
  flexGrow: 1,
});

const StyledTitle = styled(Typography)({
  fontFamily: "Nunito Sans",
  fontSize: "13px",
  fontWeight: 600,
  lineHeight: "27px",
  letterSpacing: "0.5px",
  color: "#187A90",
  textTransform: "uppercase",
});

const StyledActionsGrid = styled(Grid)({
  paddingTop: "27px",
  paddingRight: "8px",
  alignSelf: "center",
});

const FlowWrapper: FC<Props> = ({
  index,
  title,
  titleAdornment,
  titleContainerSx: titleAdornmentSx,
  last = false,
  children,
  actions,
}) => (
  <StyledGrid container>
    <StyledIndexGrid item>
      <StyledIndex>{index}</StyledIndex>
    </StyledIndexGrid>
    <StyledPrimaryGrid item>
      <Stack direction="row" alignItems="center" sx={titleAdornmentSx}>
        <StyledTitle variant="h3">{title}</StyledTitle>
        {titleAdornment}
      </Stack>
      <Box>{children}</Box>
    </StyledPrimaryGrid>
    {actions && <StyledActionsGrid item>{actions}</StyledActionsGrid>}
    {!last && (
      <Grid item xs={12}>
        <StyledRule />
      </Grid>
    )}
  </StyledGrid>
);

export default FlowWrapper;
