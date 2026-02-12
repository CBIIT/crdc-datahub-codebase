import { render } from "../../test-utils";

import SubmissionHeaderProperty from "./SubmissionHeaderProperty";

describe("Basic Functionality", () => {
  it("renders the label correctly", () => {
    const { getByText } = render(
      <SubmissionHeaderProperty label="Test Label" value="Test Value" />
    );

    expect(getByText("Test Label")).toBeInTheDocument();
  });

  it("renders the value correctly when value is a string", () => {
    const { getByText } = render(
      <SubmissionHeaderProperty label="Test Label" value="Test Value" truncateAfter={false} />
    );

    expect(getByText("Test Value")).toBeInTheDocument();
  });

  it("renders the truncated value when truncateAfter is provided", async () => {
    const { getByText } = render(
      <SubmissionHeaderProperty
        label="Test Label"
        value="This is a very long value that needs to be truncated"
        truncateAfter={2}
      />
    );

    expect(getByText("Th...")).toBeInTheDocument();
  });

  it("renders the value correctly when value is a JSX.Element", () => {
    const valueElement = <span data-testid="custom-element">Custom Value</span>;

    const { getByTestId } = render(
      <SubmissionHeaderProperty label="Test Label" value={valueElement} />
    );

    expect(getByTestId("custom-element")).toBeInTheDocument();
    expect(getByTestId("custom-element")).toHaveTextContent("Custom Value");
  });

  it("renders the full value when truncateAfter is false", () => {
    const { getByText, queryByTestId } = render(
      <SubmissionHeaderProperty
        label="Test Label"
        value="This is a very long value that should not be truncated"
        truncateAfter={false}
      />
    );

    expect(getByText("This is a very long value that should not be truncated")).toBeInTheDocument();
    expect(queryByTestId("truncated-text-label")).not.toBeInTheDocument();
  });

  it("renders correctly when value is an empty string", () => {
    const { getByTestId } = render(<SubmissionHeaderProperty label="Test Label" value="" />);

    expect(getByTestId("property-value")).toBeInTheDocument();
    expect(getByTestId("truncated-text-label")).toBeEmptyDOMElement();
  });
});
