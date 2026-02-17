import { Tab, TabProps, styled } from "@mui/material";
import React, { ElementType } from "react";
import { Link, LinkProps } from "react-router-dom";

const StyledTab = styled(Tab, {
  shouldForwardProp: (prop) => prop !== "isSelected",
})<TabProps & LinkProps & { component: ElementType; isSelected?: boolean }>(({ isSelected }) => ({
  color: "#00577C",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "17px",
  fontStyle: "normal",
  fontWeight: 600,
  lineHeight: "19.6px",
  borderRadius: "8px 8px 0px 0px",
  borderTop: "1.25px solid transparent",
  borderRight: "1.25px solid transparent",
  borderLeft: "1.25px solid transparent",
  background: "transparent",
  textTransform: "initial",
  marginRight: 0,
  display: "inline-flex",
  padding: "14.49px 25px 11.51px 23px",
  justifyContent: "center",
  alignItems: "center",
  opacity: 1,
  zIndex: isSelected ? 2 : 0,
  minHeight: 0,
  alignSelf: "flex-end",

  ...(isSelected && {
    color: "#156071",
    fontWeight: 800,
    borderRadius: "8px 8px 0px 0px",
    borderTop: "1.25px solid #6CACDA",
    borderRight: "1.25px solid #6CACDA",
    borderLeft: "1.25px solid #6CACDA",
    borderBottom: "1.25px solid transparent",
    background: "#FFF",
  }),
}));

type Props = {
  label: string;
  value: string;
  to: string;
  selected?: boolean;
} & TabProps &
  LinkProps;

const LinkTab = ({ label, value, to, selected, ...rest }: Props) => (
  <StyledTab
    component={Link}
    label={label}
    to={to}
    value={value}
    isSelected={selected}
    draggable="false"
    disableTouchRipple
    disableRipple
    {...rest}
  />
);

export default React.memo(LinkTab);
