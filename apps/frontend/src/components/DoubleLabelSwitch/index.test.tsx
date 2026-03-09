import userEvent from "@testing-library/user-event";

import { render } from "../../test-utils";

import DoubleLabelSwitch from "./index";

describe("DoubleLabelSwitch", () => {
  it("renders the left and right labels correctly", () => {
    const { getByTestId } = render(<DoubleLabelSwitch leftLabel="Left" rightLabel="Right" />);

    expect(getByTestId("left-label")).toHaveTextContent("Left");
    expect(getByTestId("right-label")).toHaveTextContent("Right");
  });

  it("shows the left label as selected (color #415053) and right label unselected (color #5F7B81) when checked is false", () => {
    const { getByTestId } = render(
      <DoubleLabelSwitch leftLabel="Off" rightLabel="On" checked={false} />
    );

    const leftLabel = getByTestId("left-label");
    const rightLabel = getByTestId("right-label");

    // selected => "#415053", unselected => "#5F7B81"
    expect(leftLabel).toHaveTextContent("Off");
    expect(leftLabel).toHaveStyle("color: #415053");
    expect(rightLabel).toHaveTextContent("On");
    expect(rightLabel).toHaveStyle("color: #5F7B81");
  });

  it("shows the right label as selected (color #415053) and left label unselected (color #5F7B81) when checked is true", () => {
    const { getByTestId } = render(<DoubleLabelSwitch leftLabel="Off" rightLabel="On" checked />);

    const leftLabel = getByTestId("left-label");
    const rightLabel = getByTestId("right-label");

    expect(leftLabel).toHaveTextContent("Off");
    expect(leftLabel).toHaveStyle("color: #5F7B81");

    expect(rightLabel).toHaveTextContent("On");
    expect(rightLabel).toHaveStyle("color: #415053");
  });

  it("calls onChange handler when the switch is toggled", async () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <DoubleLabelSwitch leftLabel="Off" rightLabel="On" checked={false} onChange={onChange} />
    );

    const switchInput = getByTestId("toggle-input") as HTMLInputElement;

    await userEvent.click(switchInput);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("renders safely even with empty labels", () => {
    const { getByTestId } = render(<DoubleLabelSwitch leftLabel="" rightLabel="" />);
    const switchWrapper = getByTestId("double-label-switch");
    expect(switchWrapper).toBeInTheDocument();

    expect(getByTestId("toggle-input")).toBeInTheDocument();
  });
});
