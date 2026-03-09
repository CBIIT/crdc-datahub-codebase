import React from "react";
import { BrowserRouter } from "react-router-dom";
import { axe } from "vitest-axe";

import { render } from "../../test-utils";

import { UserGuide } from "./UserGuide";

vi.mock("../../config/HeaderConfig", async () => ({
  ...(await vi.importActual("../../config/HeaderConfig")),
  DataSubmissionInstructionsLink: "/data-submission-instructions",
}));

const Router = (p) => (
  <BrowserRouter {...p} future={{ v7_startTransition: true, v7_relativeSplatPath: true }} />
);

describe("Accessibility", () => {
  it("should not have accessibility violations", async () => {
    const { container } = render(<UserGuide />, { wrapper: Router });

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Implementation Requirements", () => {
  it("should have a link to the instructions", () => {
    const { getByText, getByRole } = render(<UserGuide />, { wrapper: Router });

    const linkElement = getByRole("link", { name: /Data Submission Instructions/i });
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toBe(getByText(/Data Submission Instructions/i));
    expect(linkElement).toHaveAttribute("href", "/data-submission-instructions");
    expect(linkElement).toHaveAttribute("target", "_blank");
  });
});
