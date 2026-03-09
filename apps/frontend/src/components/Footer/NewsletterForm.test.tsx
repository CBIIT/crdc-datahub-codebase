import userEvent from "@testing-library/user-event";
import { act } from "react-dom/test-utils";
import { axe } from "vitest-axe";

import { render, waitFor, within } from "../../test-utils";

import NewsletterForm from "./NewsletterForm";

vi.stubGlobal("open", vi.fn());

const mockWindowOpen = vi.spyOn(window, "open");

describe("Accessibility", () => {
  it("should not have any accessibility violations", async () => {
    const { container } = render(<NewsletterForm />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    expect(() => render(<NewsletterForm />)).not.toThrow();
  });

  it("should not render the topic_id field visually", () => {
    const { getByTestId } = render(<NewsletterForm data-testid="newsletter-form" />);

    expect(getByTestId("topic-id-input")).toBeInTheDocument();
    expect(getByTestId("topic-id-input")).not.toBeVisible();
  });
});

describe("Implementation Requirements", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should have a newsletter form", () => {
    const { getByTestId } = render(<NewsletterForm data-testid="newsletter-form" />);

    expect(getByTestId("newsletter-form")).toBeInTheDocument();
    expect(
      within(getByTestId("newsletter-form")).getByRole("textbox", {
        name: "Sign up for the newsletter",
      })
    ).toBeInTheDocument();
  });

  it("should submit the newsletter form if all fields are valid", async () => {
    const { getByTestId } = render(<NewsletterForm data-testid="newsletter-form" />);

    userEvent.type(
      within(getByTestId("newsletter-form")).getByTestId("email-input"),
      "test.email@nih.gov"
    );

    // Act warning caused by RHF reset
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      userEvent.click(
        within(getByTestId("newsletter-form")).getByRole("button", {
          name: "Sign up",
        })
      );
    });

    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringMatching(/topic_id=USNIHNCI_255/),
      expect.anything()
    );
    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`email=${encodeURIComponent("test.email@nih.gov")}`)),
      expect.anything()
    );
  });

  it.each<string>([" ", "fake@email", "abc.com", "123-123-123@gmail"])(
    "should not submit the newsletter form if the email is invalid (%s)",
    async (value) => {
      const { getByTestId } = render(<NewsletterForm data-testid="newsletter-form" />);

      userEvent.type(within(getByTestId("newsletter-form")).getByTestId("email-input"), value);

      userEvent.click(
        within(getByTestId("newsletter-form")).getByRole("button", {
          name: "Sign up",
        })
      );

      expect(mockWindowOpen).not.toHaveBeenCalled();
    }
  );

  it("should not submit the newsletter form if the email is invalid (empty)", async () => {
    const { getByTestId } = render(<NewsletterForm data-testid="newsletter-form" />);

    userEvent.click(
      within(getByTestId("newsletter-form")).getByRole("button", {
        name: "Sign up",
      })
    );

    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it("should submit the form to the correct URL", async () => {
    const { getByTestId } = render(<NewsletterForm data-testid="newsletter-form" />);

    userEvent.type(
      within(getByTestId("newsletter-form")).getByTestId("email-input"),
      "valid-email@nih.gov"
    );

    // Act warning caused by RHF reset
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      userEvent.click(
        within(getByTestId("newsletter-form")).getByRole("button", {
          name: "Sign up",
        })
      );
    });

    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringMatching(
        /https:\/\/public\.govdelivery\.com\/accounts\/USNIHNCI\/subscribers\/qualify/
      ),
      "_blank"
    );
  });

  it("should reset the form after submission", async () => {
    const { getByTestId } = render(<NewsletterForm data-testid="newsletter-form" />);

    userEvent.type(
      within(getByTestId("newsletter-form")).getByTestId("email-input"),
      "valid@nih.gov"
    );

    // Act warning caused by RHF reset
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      userEvent.click(
        within(getByTestId("newsletter-form")).getByRole("button", {
          name: "Sign up",
        })
      );
    });

    await waitFor(() => {
      expect(within(getByTestId("newsletter-form")).getByTestId("email-input")).toHaveValue("");
    });
  });
});
