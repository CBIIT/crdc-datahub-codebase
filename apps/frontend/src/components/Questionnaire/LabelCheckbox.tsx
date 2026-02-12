import { Checkbox, CheckboxProps, FormControlLabelProps, styled } from "@mui/material";
import { FC } from "react";

import CheckboxCheckedIcon from "../../assets/icons/checkbox_checked.svg?react";

const StyledCheckboxCheckedIcon = styled(CheckboxCheckedIcon)<{
  readOnly?: boolean;
}>(({ readOnly }) => ({
  width: "16px",
  height: "16px",
  color: "#1D91AB",
  backgroundColor: readOnly ? "#E5EEF4" : "initial",
  cursor: readOnly ? "not-allowed" : "pointer",
}));

const StyledCheckboxUncheckedIcon = styled("div")<{ readOnly?: boolean }>(({ readOnly }) => ({
  width: "16px",
  height: "16px",
  color: "#083A50",
  outline: "2px solid #1D91AB",
  outlineOffset: -2,
  backgroundColor: readOnly ? "#E5EEF4" : "initial",
  cursor: readOnly ? "not-allowed" : "pointer",
}));

const StyledCheckbox = styled(Checkbox)<{ readOnly?: boolean }>(({ readOnly }) => ({
  padding: "2px 8px 2px 0",
  cursor: readOnly ? "not-allowed" : "pointer",
}));

export const UncheckedIcon = styled("div")<{ readOnly?: boolean }>(({ readOnly }) => ({
  outline: "2px solid #1D91AB",
  outlineOffset: -2,
  width: "16px",
  height: "16px",
  backgroundColor: readOnly ? "#E5EEF4" : "initial",
  color: "#083A50",
  cursor: readOnly ? "not-allowed" : "pointer",
}));

type Props = {
  idPrefix?: string;
  formControlLabelProps?: FormControlLabelProps;
} & CheckboxProps;

const LabelCheckbox: FC<Props> = ({
  idPrefix,
  formControlLabelProps,
  checked,
  name,
  value,
  onChange,
  readOnly,
  ...rest
}) => (
  <>
    <StyledCheckbox
      id={idPrefix?.concat(`-label-checkbox`)}
      checked={checked}
      onChange={(e, checked) => !readOnly && onChange(e, checked)}
      readOnly={readOnly}
      icon={<StyledCheckboxUncheckedIcon readOnly={readOnly} />}
      checkedIcon={<StyledCheckboxCheckedIcon readOnly={readOnly} />}
      {...rest}
    />
    {/* NOTE: This is a proxy element for form parsing purposes. */}
    <input
      name={name}
      type="checkbox"
      data-type="boolean"
      value={checked ? "true" : "false"}
      onChange={() => {}}
      aria-label={rest?.inputProps?.["aria-label"]}
      checked
      hidden
    />
  </>
);

export default LabelCheckbox;
