import { Typography, styled } from "@mui/material";
import React, { MutableRefObject, forwardRef, useId } from "react";

const StyledFormContainer = styled("div")({
  background: "transparent",
  borderRadius: "8px",
  paddingBottom: "25px",
  marginTop: "0px !important",
  scrollMarginTop: "0px",
});

const StyledForm = styled("form")(() => ({
  fontWeight: 400,
  fontSize: "16px",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
}));

const StyledTitleGroup = styled("div")(() => ({
  background: "transparent",
  color: "#337E90",
  paddingBottom: "40px",
  borderRadius: "8px 8px 0 0",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
}));

const StyledSectionTitle = styled(Typography)(() => ({
  fontWeight: 700,
  fontSize: "24px",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  lineHeight: "32.74px",
}));

type Props = {
  /**
   * Description of the form section
   */
  description: string;
  /**
   * Optional adornment to be displayed with the description
   */
  descriptionAdornment?: React.ReactNode;
  /**
   * Form section content
   */
  children: React.ReactNode;
  /**
   * Element to be displayed before the section form content
   */
  prefixElement?: React.ReactNode;
  /**
   * Reference to the form element in the DOM
   */
  formRef?: MutableRefObject<HTMLFormElement>;
};

/**
 * Generic Outermost Form Section Container Element (e.g. Section A, ...)
 *
 * @param {Props} props
 * @returns {JSX.Element}
 */
const FormContainer = forwardRef<HTMLDivElement, Props>(
  ({ prefixElement, description, descriptionAdornment, children, formRef }, ref) => {
    const id = useId();

    return (
      <StyledFormContainer ref={ref}>
        {prefixElement}
        <div data-pdf-print-region="true">
          <StyledTitleGroup>
            <StyledSectionTitle variant="h2">{description}</StyledSectionTitle>
            <span data-print="false">{descriptionAdornment}</span>
          </StyledTitleGroup>
          <StyledForm id={id} ref={formRef} onSubmit={(e) => e.preventDefault()}>
            {children}
          </StyledForm>
        </div>
      </StyledFormContainer>
    );
  }
);

export default FormContainer;
