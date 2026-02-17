import RemoveCircleIcon from "@mui/icons-material/RemoveCircle";
import { Grid, styled } from "@mui/material";
import React, { FC } from "react";

import AddRemoveButton from "../AddRemoveButton";
import { Status as FormStatus, useFormContext } from "../Contexts/FormContext";

import DatePickerInput from "./DatePickerInput";
import TextInput from "./TextInput";

const GridContainer = styled(Grid)(() => ({
  border: "0.5px solid #DCDCDC !important",
  borderRadius: "10px",
  padding: "18px 15px",
}));

const StyledTextInput = styled(TextInput)(() => ({
  "&.MuiInputBase-multiline .MuiInputBase-input": {
    lineHeight: "17px !important",
  },
}));

type Props = {
  idPrefix?: string;
  index: number;
  timeConstraint: TimeConstraint | null;
  readOnly?: boolean;
  onDelete: () => void;
};

const TimeConstraint: FC<Props> = ({
  idPrefix = "",
  index,
  timeConstraint,
  readOnly,
  onDelete,
}) => {
  const { status } = useFormContext();
  const { description, effectiveDate } = timeConstraint;

  return (
    <GridContainer container>
      <Grid container item xs={12} rowSpacing={0} columnSpacing={1.5}>
        <StyledTextInput
          id={idPrefix.concat(`time-constraint-${index}-description`)}
          label="Time Constraint Description"
          name={`timeConstraints[${index}][description]`}
          value={description}
          gridWidth={12}
          maxLength={100}
          placeholder="100 characters allowed"
          minRows={2}
          multiline
          required
          readOnly={readOnly}
        />
        <DatePickerInput
          inputID={idPrefix.concat(`time-constraint-${index}-effective-date`)}
          label="Time Constraint Effective Date"
          name={`timeConstraints[${index}][effectiveDate]`}
          initialValue={effectiveDate}
          required
          disablePast
          tooltipText="Date relating to this constraint"
          readOnly={readOnly}
        />
      </Grid>
      <Grid item xs={12}>
        <AddRemoveButton
          id={idPrefix.concat(`time-constraint-${index}-remove-time-constraint-button`)}
          label="Remove Time Constraint"
          placement="start"
          onClick={onDelete}
          startIcon={<RemoveCircleIcon />}
          iconColor="#E74040"
          disabled={readOnly || status === FormStatus.SAVING}
        />
      </Grid>
    </GridContainer>
  );
};

export default TimeConstraint;
