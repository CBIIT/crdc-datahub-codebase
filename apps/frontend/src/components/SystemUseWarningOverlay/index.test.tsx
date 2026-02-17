import { axe } from "vitest-axe";

import { render } from "../../test-utils";

import OverlayWindow from "./OverlayWindow";

beforeEach(() => {
  window.localStorage.clear();
});

it("should not have any accessibility violations", async () => {
  const { container, findByTestId } = render(<OverlayWindow />);

  await findByTestId("system-use-warning-dialog");

  expect(await axe(container)).toHaveNoViolations();
});
