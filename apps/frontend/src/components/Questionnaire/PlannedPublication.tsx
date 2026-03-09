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

type Props = {
  idPrefix?: string;
  index: number;
  plannedPublication: PlannedPublication | null;
  readOnly?: boolean;
  onDelete: () => void;
};

/**
 * Additional Contact Form Group
 *
 * @param {Props} props
 * @returns {JSX.Element}
 */
const PlannedPublication: FC<Props> = ({
  idPrefix = "",
  index,
  plannedPublication,
  readOnly,
  onDelete,
}: Props) => {
  const { status } = useFormContext();

  const { title, expectedDate } = plannedPublication;

  return (
    <GridContainer container>
      <Grid container item xs={12} rowSpacing={0} columnSpacing={1.5}>
        <TextInput
          id={idPrefix.concat(`planned-publication-${index}-title`)}
          label="Publication Title"
          name={`study[plannedPublications][${index}][title]`}
          value={title}
          placeholder="500 characters allowed"
          maxLength={500}
          gridWidth={12}
          required
          readOnly={readOnly}
        />
        <DatePickerInput
          inputID={idPrefix.concat(`planned-publication-${index}-expected-publication-date`)}
          label="Expected Publication Date"
          name={`study[plannedPublications][${index}][expectedDate]`}
          initialValue={expectedDate}
          gridWidth={6}
          disablePast
          format="MM/DD/YYYY"
          required
          readOnly={readOnly}
          tooltipText="Data made available for secondary research only
                      after investigators have obtained approval from
                      NIH to use the requested data for a particular
                      project"
        />
      </Grid>
      <Grid item xs={12}>
        <AddRemoveButton
          id={idPrefix.concat(`planned-publication-${index}-remove-planned-publication-button`)}
          label="Remove Planned Publication"
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

export default PlannedPublication;
