import { Stack, styled, Switch, SwitchProps, Typography } from "@mui/material";
import { isEqual } from "lodash";
import React from "react";

const StyledSwitch = styled((props: SwitchProps) => (
  <Switch
    focusVisibleClassName=".Mui-focusVisible"
    disableRipple
    {...props}
    inputProps={
      { "data-testid": "toggle-input", "aria-label": "Switch input" } as SwitchProps["inputProps"]
    }
  />
))(({ theme }) => ({
  width: 65,
  height: 34,
  padding: 0,
  "& .MuiSwitch-switchBase": {
    padding: 0,
    margin: "4px 7px 5px",
    transitionDuration: "300ms",
    "&.Mui-checked": {
      transform: "translateX(26px)",
      color: "#fff",
      "& + .MuiSwitch-track": {
        opacity: 1,
        border: "1px solid #A5A5A5",
        backgroundColor: "#FFF",
      },
      "&.Mui-disabled + .MuiSwitch-track": {
        opacity: 0.5,
      },
    },
    "&.Mui-disabled .MuiSwitch-thumb": {
      color: theme.palette.grey[600],
    },
    "&.Mui-disabled + .MuiSwitch-track": {
      opacity: 0.3,
    },
  },
  "& .MuiSwitch-thumb": {
    boxSizing: "border-box",
    color: "#136071",
    width: 25,
    height: 25,
  },
  "& .MuiSwitch-track": {
    borderRadius: 34 / 2,
    border: "1px solid #A5A5A5",
    opacity: 1,
    transition: theme.transitions.create(["background-color"], {
      duration: 500,
    }),
    backgroundColor: "#FFF",
  },
}));

const StyledLabel = styled(Typography, {
  shouldForwardProp: (p) => p !== "selected",
})<{ selected: boolean }>(({ selected }) => ({
  color: selected ? "#415053" : "#5F7B81",
  fontFamily: "Lato, sans-serif",
  fontSize: "16px",
  fontStyle: "normal",
  fontWeight: 600,
  lineHeight: "22px",
  letterSpacing: "0.25px",
}));

type Props = {
  leftLabel: string;
  rightLabel: string;
} & SwitchProps;

const DoubleLabelSwitch = ({ leftLabel, rightLabel, checked, ...rest }: Props) => (
  <Stack
    direction="row"
    spacing={1}
    sx={{ alignItems: "center" }}
    data-testid="double-label-switch"
  >
    <StyledLabel data-testid="left-label" selected={!checked}>
      {leftLabel}
    </StyledLabel>
    <StyledSwitch data-testid="toggle-switch" {...rest} checked={checked} />
    <StyledLabel data-testid="right-label" selected={checked}>
      {rightLabel}
    </StyledLabel>
  </Stack>
);

export default React.memo(DoubleLabelSwitch, isEqual);
