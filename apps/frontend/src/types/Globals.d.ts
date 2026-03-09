type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

type Extends<T, U extends T> = U;

type FormSectionProps = {
  refs: {
    getFormObjectRef: React.MutableRefObject<(() => FormObject | null) | null>;
  };
  SectionOption: SectionOption;
};

type FormObject = {
  /**
   * @deprecated use `formRef` in the context instead.
   */
  ref: React.RefObject<HTMLFormElement>;
  data: QuestionnaireData;
};

type SectionConfig = {
  [key in SectionKey]: SectionOption;
};

type SectionOption = {
  title: string;
  id: string;
  component: React.ComponentType<FormSectionProps>;
};

type FormGroupCheckboxOption = {
  label: string;
  value: string;
  name?: string; // overrides parent name in checkboxes
  tooltipText?: string;
  errorText?: string;
  required?: boolean;
};

type SelectOption = { label: string; value: string | number };

type HistoryBase<T> = {
  /**
   * The transitioned status of the history event.
   */
  status: T;
  /**
   * The ISO 8601 date and time the history event occurred.
   *
   * @note This is in the format of `YYYY-MM-DDTHH:MM:SSZ`.
   */
  dateTime: string;
  /**
   * The ID of the user who initiated the history event.
   */
  userID: string;
  /**
   * The name of the user who initiated the history event.
   *
   * @note This is not populated in all events.
   */
  userName?: string;
  /**
   * The comment associated with the history event.
   *
   * @note This is not populated in all events.
   */
  reviewComment?: string;
};

declare module "*.pdf";
