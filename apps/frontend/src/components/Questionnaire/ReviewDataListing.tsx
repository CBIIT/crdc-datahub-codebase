import { Grid, styled } from "@mui/material";
import { ReactNode } from "react";

import { StyledDescription, StyledTitle } from "./SectionGroup";

const GridContainer = styled(Grid)(() => ({
  "&:not(:first-of-type)": {
    marginTop: "25px",
  },
  paddingTop: 0,
}));

const StyledGridHeader = styled(Grid)(() => ({
  "&:not(:first-of-type)": {
    marginTop: "30px",
  },
  paddingTop: 0,
}));

type Props = {
  idPrefix: string;
  title?: string;
  description?: string | JSX.Element;
  hideTitle?: boolean;
  children?: ReactNode;
};

const ReviewDataListing = ({ idPrefix, title, description, hideTitle, children }: Props) => (
  <>
    {title || description ? (
      <StyledGridHeader xs={12} item>
        {title && (
          <StyledTitle id={idPrefix.concat(`-section-title`)} variant="h4">
            {!hideTitle ? title : null}
          </StyledTitle>
        )}
        {description && (
          <StyledDescription
            id={idPrefix.concat(`-section-description`)}
            variant="body1"
            data-print="false"
          >
            {description}
          </StyledDescription>
        )}
      </StyledGridHeader>
    ) : null}
    <Grid xs={12} item>
      <GridContainer container rowSpacing={0} columnSpacing={1.5}>
        {children}
      </GridContainer>
    </Grid>
  </>
);

export default ReviewDataListing;
