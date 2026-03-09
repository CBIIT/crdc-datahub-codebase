import RemoveCircleIcon from "@mui/icons-material/RemoveCircle";
import { Grid, styled } from "@mui/material";
import React, { FC } from "react";

import AddRemoveButton from "../AddRemoveButton";
import { Status as FormStatus, useFormContext } from "../Contexts/FormContext";

import TextInput from "./TextInput";

const GridContainer = styled(Grid)(() => ({
  border: "0.5px solid #DCDCDC !important",
  borderRadius: "10px",
  padding: "18px 15px",
}));

type Props = {
  idPrefix?: string;
  index: number;
  publication: Publication | null;
  readOnly?: boolean;
  onDelete: () => void;
};

/**
 * Additional Contact Form Group
 *
 * @param {Props} props
 * @returns {JSX.Element}
 */
const Publication: FC<Props> = ({
  idPrefix = "",
  index,
  publication,
  readOnly,
  onDelete,
}: Props) => {
  const { status } = useFormContext();

  const { title, pubmedID, DOI } = publication;

  return (
    <GridContainer container>
      <Grid container item xs={12} rowSpacing={0} columnSpacing={1.5}>
        <TextInput
          id={idPrefix.concat(`publication-${index}-title`)}
          label="Publication Title"
          name={`study[publications][${index}][title]`}
          value={title}
          placeholder="500 characters allowed"
          maxLength={500}
          gridWidth={12}
          required
          readOnly={readOnly}
        />
        <TextInput
          id={idPrefix.concat(`publication-${index}-pubmed-id-pmid`)}
          label="PubMed ID (PMID)"
          name={`study[publications][${index}][pubmedID]`}
          value={pubmedID}
          placeholder="Enter ID"
          maxLength={20}
          gridWidth={6}
          readOnly={readOnly}
        />
        <TextInput
          id={idPrefix.concat(`publication-${index}-DOI`)}
          label="DOI"
          name={`study[publications][${index}][DOI]`}
          value={DOI}
          placeholder="200 characters allowed"
          maxLength={200}
          gridWidth={6}
          readOnly={readOnly}
        />
      </Grid>
      <Grid item xs={12}>
        <AddRemoveButton
          id={idPrefix.concat(`publication-${index}-remove-publication-button`)}
          label="Remove Existing Publication"
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

export default Publication;
