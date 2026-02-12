import { Button, Stack, styled } from "@mui/material";
import { ElementType, memo } from "react";
import { Link, LinkProps } from "react-router-dom";

const StyledButton = styled(Button)<{ component: ElementType } & LinkProps>({
  padding: "14px 20px",
  fontWeight: 700,
  fontSize: "16px",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  letterSpacing: "2%",
  lineHeight: "20.14px",
  borderRadius: "8px",
  color: "#fff",
  textTransform: "none",
  borderColor: "#26B893 !important",
  background: "#1B8369 !important",
  marginRight: "25px",
});

const StyledBannerBody = styled(Stack)({
  marginTop: "-53px",
});

type Props = {
  label: string;
  to: LinkProps["to"];
};

const PageBannerBody = ({ label, to }: Props) => (
  <StyledBannerBody direction="row" alignItems="center" justifyContent="flex-end">
    <StyledButton component={Link} to={to} data-testid="page-banner-body-link">
      {label}
    </StyledButton>
  </StyledBannerBody>
);

export default memo(PageBannerBody);
