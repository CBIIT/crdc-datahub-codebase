import { Box, Container, styled, Typography } from "@mui/material";
import React, { FC, memo } from "react";

const StyledWrapper = styled(Box)<{ background: string }>(({ background }) => ({
  background: `url(${background})`,
  backgroundSize: "100% 296px",
  backgroundPosition: "top center",
  backgroundBlendMode: "luminosity, normal",
  backgroundRepeat: "no-repeat",
}));

const StyledContainer = styled(Container)(({ theme }) => ({
  padding: theme.spacing(4),
}));

const StyledHeader = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(4),
  marginBottom: theme.spacing(8),
}));

const StyledTitleContainer = styled("div")({});

const StyledH1 = styled(Typography)({
  fontFamily: "Nunito Sans",
  fontWeight: 800,
  fontSize: "45px",
  color: "#004A80",
  textOverflow: "ellipsis",
  overflow: "hidden",
  whiteSpace: "nowrap",
});

const StyledSuffix = styled(Typography)<{ component: React.ElementType }>({
  fontWeight: 400,
  fontSize: "45px",
  color: "#004A80",
});

const StyledDescriptionContainer = styled("div")({
  maxWidth: "600px",
  marginTop: "8px",
});

const StyledDescription = styled(Typography)({
  fontWeight: 400,
  fontSize: "16px",
  fontFamily: "Inter",
  color: "#453E3E",
});

export type PageContainerProps = {
  /**
   * The background image for the page
   */
  background: string;
  /**
   * The title of the page
   */
  title: React.ReactNode;
  /**
   * An optional suffix to append to the end of the page title
   */
  titleSuffix?: React.ReactNode;
  /**
   * An optional page description
   */
  description?: React.ReactNode;
  /**
   * The page content
   */
  children: React.ReactNode;
};

/**
 * PageContainer offers a standard page layout with the following supported elements:
 *
 * - Background
 * - Title
 * - Description
 * - Body
 *
 * @note This is a modernized replacement for {@link PageBanner}.
 * @TODO Support an action button in the header
 * @returns The PageContainer component
 */
const PageContainer: FC<PageContainerProps> = ({
  background,
  title,
  titleSuffix,
  description,
  children,
}: PageContainerProps) => (
  <StyledWrapper background={background} data-testid="page-container-wrapper">
    <StyledContainer maxWidth="xl">
      <StyledHeader data-testid="page-container-header">
        <StyledTitleContainer>
          <StyledH1 data-testid="page-container-header-title">
            {title}
            {titleSuffix && (
              <StyledSuffix component="span" data-testid="page-container-header-suffix">
                {titleSuffix}
              </StyledSuffix>
            )}
          </StyledH1>
        </StyledTitleContainer>
        {description && (
          <StyledDescriptionContainer>
            <StyledDescription data-testid="page-container-header-description">
              {description}
            </StyledDescription>
          </StyledDescriptionContainer>
        )}
      </StyledHeader>
      {children}
    </StyledContainer>
  </StyledWrapper>
);

export default memo<PageContainerProps>(PageContainer);
