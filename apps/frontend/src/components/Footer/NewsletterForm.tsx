import { FC, forwardRef, memo, useCallback } from "react";
import { SubmitHandler, useForm } from "react-hook-form";

import { validateEmail } from "../../utils";

/**
 * The props for the NewsletterForm component.
 */
export type NewsletterFormProps = React.HTMLAttributes<HTMLFormElement>;

export type NewsletterFormFields = {
  /**
   * The topic ID for the email updates subscription.
   */
  topic_id: string;
  /**
   * The email address to subscribe to the email updates.
   */
  email: string;
};

const FORM_TOPIC_ID = "USNIHNCI_255";

/**
 * Provides the Signup for email updates form.
 *
 * @note This form is unstyled, you must style it yourself.
 * @param props The form props.
 * @returns The Email newsletter form.
 */
const NewsletterForm: FC<NewsletterFormProps> = forwardRef<
  HTMLFormElement,
  React.HTMLAttributes<HTMLFormElement>
>((props, ref) => {
  const { register, handleSubmit, reset } = useForm<NewsletterFormFields>({
    defaultValues: {
      topic_id: FORM_TOPIC_ID,
      email: "",
    },
    shouldUseNativeValidation: true,
  });

  const onSubmit: SubmitHandler<NewsletterFormFields> = (data) => {
    const params = new URLSearchParams({
      topic_id: data.topic_id,
      email: data.email,
    });

    window.open(
      `https://public.govdelivery.com/accounts/USNIHNCI/subscribers/qualify?${params.toString()}`,
      "_blank"
    );

    reset();
  };

  const isValidEmail = useCallback(
    (email: string): null | string =>
      validateEmail(email) ? null : "Please enter a valid email address.",
    []
  );

  const isNotEmpty = useCallback(
    (email: string): null | string => (email?.trim().length > 0 ? null : "This field is required."),
    []
  );

  return (
    <form ref={ref} onSubmit={handleSubmit(onSubmit)} {...props}>
      <input type="hidden" data-testid="topic-id-input" {...register("topic_id")} />
      <div className="signUpTitle">Sign up for email updates</div>
      <div className="enterTitle">
        <label htmlFor="email-input">
          Sign up for the newsletter
          <input
            id="email-input"
            data-testid="email-input"
            className="signUpInputBox"
            {...register("email", {
              validate: {
                notEmpty: isNotEmpty,
                validEmail: isValidEmail,
              },
              required: "This field is required.",
            })}
          />
        </label>
      </div>
      <button type="submit" className="signUpButton">
        Sign up
      </button>
    </form>
  );
});

export default memo<NewsletterFormProps>(NewsletterForm);
