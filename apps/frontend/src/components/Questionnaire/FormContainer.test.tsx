import { render, screen } from "@testing-library/react";

import FormContainer from "./FormContainer";

describe("FormContainer", () => {
  it("should render without crashing", () => {
    expect(() =>
      render(
        <FormContainer description="Test Section">
          <div>Test Content</div>
        </FormContainer>
      )
    ).not.toThrow();
  });

  it("should render the description text", () => {
    render(
      <FormContainer description="Test Section">
        <div>Test Content</div>
      </FormContainer>
    );

    expect(screen.getByText("Test Section")).toBeInTheDocument();
  });

  it("should render children content", () => {
    render(
      <FormContainer description="Test Section">
        <div data-testid="test-child">Test Content</div>
      </FormContainer>
    );

    expect(screen.getByTestId("test-child")).toBeInTheDocument();
  });

  it("should render descriptionAdornment when provided", () => {
    render(
      <FormContainer
        description="Test Section"
        descriptionAdornment={
          <button type="button" data-testid="adornment-button">
            Download PDF
          </button>
        }
      >
        <div>Test Content</div>
      </FormContainer>
    );

    expect(screen.getByTestId("adornment-button")).toBeInTheDocument();
  });

  it("should wrap descriptionAdornment with data-print='false' to exclude from PDF export", () => {
    render(
      <FormContainer
        description="Test Section"
        descriptionAdornment={
          <button type="button" data-testid="adornment-button">
            Download PDF
          </button>
        }
      >
        <div>Test Content</div>
      </FormContainer>
    );

    const adornmentButton = screen.getByTestId("adornment-button");
    const wrapper = adornmentButton.parentElement;

    expect(wrapper).toHaveAttribute("data-print", "false");
  });

  it("should not render descriptionAdornment wrapper when descriptionAdornment is not provided", () => {
    const { container } = render(
      <FormContainer description="Test Section">
        <div>Test Content</div>
      </FormContainer>
    );

    const dataPrintFalseElements = container.querySelectorAll('[data-print="false"]');
    expect(dataPrintFalseElements.length).toBe(0);
  });

  it("should render prefixElement when provided", () => {
    render(
      <FormContainer
        description="Test Section"
        prefixElement={<div data-testid="prefix-element">Prefix</div>}
      >
        <div>Test Content</div>
      </FormContainer>
    );

    expect(screen.getByTestId("prefix-element")).toBeInTheDocument();
  });
});
