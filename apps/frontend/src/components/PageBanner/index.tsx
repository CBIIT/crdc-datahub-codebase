import { Container, styled } from "@mui/material";
import React, { FC } from "react";

const StyledBanner = styled("div")(({ bannerSrc }: { bannerSrc: string }) => ({
  background: bannerSrc ? `url("${bannerSrc}")` : "transparent",
  backgroundBlendMode: "luminosity, normal",
  backgroundSize: "cover",
  backgroundPosition: "center",
  width: "100%",
  height: "296px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
}));

const StyledBannerContentContainer = styled(Container)(({ padding }: { padding?: string }) => ({
  "&.MuiContainer-root": {
    padding: padding || "57px 0 0 65px",
    width: "100%",
    height: "100%",
  },
}));

const StyledBannerTitle = styled("h1")({
  height: "79px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  flexShrink: 0,
  color: "#3E577C",
  fontSize: "45px",
  fontFamily: "'Nunito Sans', 'Rubik', sans-serif",
  fontWeight: 800,
  lineHeight: "40px",
  letterSpacing: "-1.5px",
  margin: 0,
});

const StyledBannerSubtitle = styled("h2")({
  display: "flex",
  maxWidth: "565px",
  height: "59px",
  flexDirection: "column",
  flexShrink: 0,
  color: "#453E3E",
  fontSize: "16px",
  fontFamily: "'Inter', 'Rubik', sans-serif",
  fontWeight: 400,
  lineHeight: "22px",
  margin: "0 0 0 5px",
});

export type Props = {
  title: string;
  subTitle: string;
  padding?: string;
  body?: string | React.ReactNode;
  bannerSrc?: string;
};

/**
 * Generic Page Banner component
 *
 * @note Only use this component if necessary. Recommend {@link PageContainer} for most use cases.
 * @returns The PageBanner component
 */
const PageBanner: FC<Props> = ({ title, subTitle, padding, body, bannerSrc }: Props) => (
  <StyledBanner bannerSrc={bannerSrc}>
    <StyledBannerContentContainer maxWidth="xl" padding={padding}>
      <StyledBannerTitle>{title}</StyledBannerTitle>
      {subTitle && <StyledBannerSubtitle>{subTitle}</StyledBannerSubtitle>}
      {body}
    </StyledBannerContentContainer>
  </StyledBanner>
);

export default PageBanner;
