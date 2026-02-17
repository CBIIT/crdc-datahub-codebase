import RemoveCircleIcon from "@mui/icons-material/RemoveCircle";
import { Grid, styled } from "@mui/material";
import { FC, useCallback, useState } from "react";

import useAggregatedInstitutions from "@/hooks/useAggregatedInstitutions";

import { filterForNumbers, validateEmail, validateUTF8 } from "../../utils";
import AddRemoveButton from "../AddRemoveButton";
import { Status as FormStatus, useFormContext } from "../Contexts/FormContext";

import AutocompleteInput from "./AutocompleteInput";
import TextInput from "./TextInput";

const GridContainer = styled(Grid)({
  border: "0.5px solid #DCDCDC !important",
  borderRadius: "10px",
  padding: "18px 15px",
});

const HiddenField = styled("input")({
  display: "none",
});

type Props = {
  idPrefix?: string;
  index: number;
  contact: Contact | null;
  readOnly?: boolean;
  onDelete: () => void;
};

/**
 * Provides a form group for an Additional Contact field.
 *
 * @returns The Additional Contact
 */
const AdditionalContact: FC<Props> = ({
  idPrefix = "",
  index,
  contact,
  readOnly,
  onDelete,
}: Props) => {
  const { status } = useFormContext();
  const { data: institutionList } = useAggregatedInstitutions();
  const { firstName, lastName, email, phone, position, institution, institutionID } = contact;

  const [institutionName, setInstitutionName] = useState<string>(institution || "");
  const [institutionId, setInstitutionId] = useState<string>(institutionID || "");

  const handleInputChange = useCallback(
    (value: string) => {
      const apiData = institutionList.find((i) => i.name === value);

      // NOTE: Try to utilize API data first, fallback to user-provided details
      setInstitutionId(apiData?._id || "");
      setInstitutionName(apiData?.name || value);
    },
    [institutionList]
  );

  return (
    <GridContainer container>
      <Grid container item xs={12} rowSpacing={0} columnSpacing={1.5}>
        <TextInput
          id={idPrefix.concat(`additionalContacts-${index}-first-name`)}
          label="First name"
          name={`additionalContacts[${index}][firstName]`}
          value={firstName}
          placeholder="Enter first name"
          maxLength={50}
          required
          readOnly={readOnly}
        />
        <TextInput
          id={idPrefix.concat(`additionalContacts-${index}-last-name`)}
          label="Last name"
          name={`additionalContacts[${index}][lastName]`}
          value={lastName}
          placeholder="Enter last name"
          maxLength={50}
          required
          readOnly={readOnly}
        />
        <TextInput
          id={idPrefix.concat(`additionalContacts-${index}-position`)}
          label="Position"
          name={`additionalContacts[${index}][position]`}
          value={position}
          placeholder="Enter position"
          maxLength={100}
          required
          readOnly={readOnly}
        />
        <TextInput
          id={idPrefix.concat(`additionalContacts-${index}-email`)}
          label="Email"
          name={`additionalContacts[${index}][email]`}
          type="email"
          value={email}
          validate={validateEmail}
          errorText="Please provide a valid email address"
          placeholder="Enter email"
          required
          readOnly={readOnly}
        />
        <AutocompleteInput
          id={idPrefix.concat(`additionalContacts-${index}-institution`)}
          label="Institution"
          name={`additionalContacts[${index}][institution]`}
          value={institutionName}
          options={institutionList?.map((i) => i.name)}
          placeholder="Enter or Select an Institution"
          validate={(v: string) => v?.trim()?.length > 0 && !validateUTF8(v)}
          onChange={(_, val) => handleInputChange(val)}
          onInputChange={(_, val, reason) => {
            // NOTE: If reason is not 'input', then the user did not trigger this event
            if (reason === "input") {
              handleInputChange(val);
            }
          }}
          required
          disableClearable
          freeSolo
          readOnly={readOnly}
        />
        <HiddenField
          type="text"
          name={`additionalContacts[${index}][institutionID]`}
          value={institutionId}
          onChange={() => {}}
          data-type="string"
          aria-label="Institution ID field"
          hidden
        />
        <TextInput
          id={idPrefix.concat(`additionalContacts-${index}-phone-number`)}
          label="Phone number"
          name={`additionalContacts[${index}][phone]`}
          type="tel"
          filter={filterForNumbers}
          value={phone}
          placeholder="Enter phone number"
          maxLength={25}
          readOnly={readOnly}
        />
      </Grid>
      <Grid item xs={12}>
        <AddRemoveButton
          id={idPrefix.concat(`additionalContacts-${index}-remove-contact-button`)}
          label="Remove Contact"
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

export default AdditionalContact;
