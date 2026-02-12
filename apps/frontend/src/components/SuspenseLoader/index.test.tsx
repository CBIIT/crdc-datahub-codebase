import { axe } from "vitest-axe";

import { render } from "../../test-utils";

import Loader from "./index";

describe("Loader Accessibility Tests", () => {
  it("fullscreen accessibility", async () => {
    const { container } = render(<Loader fullscreen />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("absolute to container accessibility", async () => {
    const { container } = render(<Loader fullscreen={false} />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
