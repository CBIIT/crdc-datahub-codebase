import RemoveCircleIcon from "@mui/icons-material/RemoveCircle";
import { Grid, styled } from "@mui/material";
import React, { FC, useEffect, useMemo, useState } from "react";

import DataTypes from "../../config/DataTypesConfig";
import AddRemoveButton from "../AddRemoveButton";
import { Status as FormStatus, useFormContext } from "../Contexts/FormContext";

import SelectInput from "./SelectInput";
import TextInput from "./TextInput";

const GridContainer = styled(Grid)(() => ({
  border: "0.5px solid #DCDCDC !important",
  borderRadius: "10px",
  padding: "18px 15px",
}));

export const repositoryDataTypesOptions = [
  DataTypes.clinicalTrial,
  DataTypes.genomics,
  DataTypes.imaging,
  DataTypes.proteomics,
  { name: "Other", label: "Other" },
];

type Props = {
  idPrefix?: string;
  index: number;
  repository: Repository | null;
  readOnly?: boolean;
  onDelete: () => void;
};

/**
 * Additional Contact Form Group
 *
 * @param {Props} props
 * @returns {JSX.Element}
 */
const Repository: FC<Props> = ({ idPrefix = "", index, repository, readOnly, onDelete }: Props) => {
  const { status } = useFormContext();

  const { name, studyID, dataTypesSubmitted, otherDataTypesSubmitted } = repository || {};
  const [dataTypes, setDataTypes] = useState<string[]>(dataTypesSubmitted || []);
  const [otherDataTypes, setOtherDataTypes] = useState<string>(otherDataTypesSubmitted || "");

  useEffect(() => {
    setDataTypes(dataTypesSubmitted || []);
  }, [dataTypesSubmitted]);

  useEffect(() => {
    setOtherDataTypes(otherDataTypesSubmitted || "");
  }, [otherDataTypesSubmitted]);

  const isOtherSelected = useMemo(() => dataTypes?.includes("Other"), [dataTypes]);

  const handleDataTypesChange = (value: string[]) => {
    setDataTypes(value);

    if (!value?.includes("Other")) {
      setOtherDataTypes("");
    }
  };

  return (
    <GridContainer container data-testid={idPrefix.concat(`repository-${index}`)}>
      <Grid container item xs={12} rowSpacing={0} columnSpacing={1.5}>
        <TextInput
          id={idPrefix.concat(`repository-${index}-name`)}
          label="Repository Name"
          name={`study[repositories][${index}][name]`}
          value={name}
          placeholder="Enter Repository Name"
          maxLength={50}
          gridWidth={6}
          tooltipText="Name of the repository (e.g., GEO, EGA, etc.)"
          required
          readOnly={readOnly}
          data-testid={idPrefix.concat(`repository-${index}-name`)}
        />
        <TextInput
          id={idPrefix.concat(`repository-${index}-study-id`)}
          label="Study ID"
          name={`study[repositories][${index}][studyID]`}
          value={studyID}
          placeholder="Enter ID"
          maxLength={50}
          gridWidth={6}
          tooltipText="Associated repository study identifier"
          required
          readOnly={readOnly}
          data-testid={idPrefix.concat(`repository-${index}-study-id`)}
        />
        <SelectInput
          id={idPrefix.concat(`repository-${index}-data-types-submitted`)}
          label="Data Type(s) Submitted"
          name={`study[repositories][${index}][dataTypesSubmitted]`}
          options={repositoryDataTypesOptions.map((option) => ({
            label: option.label,
            value: option.name,
          }))}
          placeholder="Select types"
          value={dataTypesSubmitted}
          multiple
          tooltipText="Data type(s) submitted"
          required
          readOnly={readOnly}
          onChange={handleDataTypesChange}
          data-testid={idPrefix.concat(`repository-${index}-data-types-submitted`)}
        />
        <TextInput
          id={idPrefix.concat(`repository-${index}-other-data-types-submitted`)}
          label="Other Data Type(s)"
          tooltipText='Enter additional Data Types, separated by pipes ("|").'
          name={`study[repositories][${index}][otherDataTypesSubmitted]`}
          value={otherDataTypes}
          placeholder="Other, specify as free text"
          maxLength={100}
          gridWidth={6}
          required={isOtherSelected}
          readOnly={!isOtherSelected || readOnly}
          onChange={(e) => setOtherDataTypes(e.target.value)}
          data-testid={idPrefix.concat(`repository-${index}-other-data-types-submitted`)}
        />
      </Grid>
      <Grid item xs={12}>
        <AddRemoveButton
          id={idPrefix.concat(`repository-${index}-remove-repository-button`)}
          label="Remove Repository"
          placement="start"
          onClick={onDelete}
          startIcon={<RemoveCircleIcon />}
          iconColor="#E74040"
          disabled={readOnly || status === FormStatus.SAVING}
          data-testid={idPrefix.concat(`repository-${index}-remove-button`)}
        />
      </Grid>
    </GridContainer>
  );
};

export default Repository;
