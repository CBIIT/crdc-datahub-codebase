import RemoveCircleIcon from "@mui/icons-material/RemoveCircle";
import { Grid, styled } from "@mui/material";
import React, { FC } from "react";

import fundingAgencyOptions from "../../config/FundingConfig";
import AddRemoveButton from "../AddRemoveButton";
import { Status as FormStatus, useFormContext } from "../Contexts/FormContext";

import Autocomplete from "./AutocompleteInput";
import TextInput from "./TextInput";

const GridContainer = styled(Grid)(() => ({
  border: "0.5px solid #DCDCDC !important",
  borderRadius: "10px",
  padding: "18px 15px",
}));

type Props = {
  idPrefix?: string;
  index: number;
  funding: Funding | null;
  readOnly?: boolean;
  onDelete: () => void;
};

/**
 * Additional Contact Form Group
 *
 * @param {Props} props
 * @returns {JSX.Element}
 */
const FundingAgency: FC<Props> = ({ idPrefix = "", index, funding, readOnly, onDelete }: Props) => {
  const { status } = useFormContext();

  const { agency, grantNumbers, nciProgramOfficer } = funding || {};

  return (
    <GridContainer container>
      <Grid container item xs={12} rowSpacing={0} columnSpacing={1.5}>
        <Autocomplete
          id={idPrefix.concat(`funding-agency-${index}-organization`)}
          label="Funding Agency/Organization"
          value={agency}
          name={`study[funding][${index}][agency]`}
          options={fundingAgencyOptions}
          placeholder="Enter or select an agency/organization"
          freeSolo
          disableClearable
          required
          validate={(value: string) => value?.length > 0}
          readOnly={readOnly}
        />
        <TextInput
          id={idPrefix.concat(`funding-agency-${index}-grant-or-contract-numbers`)}
          label="Grant or Contract Number(s)"
          name={`study[funding][${index}][grantNumbers]`}
          value={grantNumbers}
          maxLength={250}
          placeholder="Enter Grant or Contract Number(s)"
          tooltipText={
            <>
              For US federally funded studies, include:
              <br />
              Grant or Contract number(s), for example, R01CAXXXX.
            </>
          }
          required
          readOnly={readOnly}
        />
        <TextInput
          id={idPrefix.concat(`funding-agency-${index}-nci-program-officer`)}
          label="NCI Program Officer"
          name={`study[funding][${index}][nciProgramOfficer]`}
          value={nciProgramOfficer}
          placeholder="Enter NCI Program Officer"
          maxLength={50}
          readOnly={readOnly}
        />
      </Grid>
      <Grid item xs={12}>
        {index !== 0 ? (
          <AddRemoveButton
            id={idPrefix.concat(`funding-agency-${index}-remove-agency-button`)}
            label="Remove Agency"
            placement="start"
            onClick={onDelete}
            startIcon={<RemoveCircleIcon />}
            iconColor="#E74040"
            disabled={readOnly || status === FormStatus.SAVING}
          />
        ) : null}
      </Grid>
    </GridContainer>
  );
};

export default FundingAgency;
