import { parseForm } from "@jalik/form-parser";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import { Checkbox, FormControlLabel, Grid, styled } from "@mui/material";
import { cloneDeep, unset } from "lodash";
import { FC, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import useAggregatedInstitutions from "@/hooks/useAggregatedInstitutions";
import useFormMode from "@/hooks/useFormMode";

import AddRemoveButton from "../../../components/AddRemoveButton";
import { Status as FormStatus, useFormContext } from "../../../components/Contexts/FormContext";
import PansBanner from "../../../components/PansBanner";
import AdditionalContact from "../../../components/Questionnaire/AdditionalContact";
import AutocompleteInput from "../../../components/Questionnaire/AutocompleteInput";
import FormContainer from "../../../components/Questionnaire/FormContainer";
import SectionGroup from "../../../components/Questionnaire/SectionGroup";
import TextInput from "../../../components/Questionnaire/TextInput";
import TransitionGroupWrapper from "../../../components/Questionnaire/TransitionGroupWrapper";
import { InitialQuestionnaire } from "../../../config/InitialValues";
import SectionMetadata from "../../../config/SectionMetadata";
import {
  combineQuestionnaireData,
  filterForNumbers,
  formatORCIDInput,
  isValidORCID,
  mapObjectWithKey,
  validateEmail,
  validateUTF8,
} from "../../../utils";

export type KeyedContact = {
  key: string;
} & Contact;

const StyledFormControlLabel = styled(FormControlLabel)({
  transform: "translateY(-15px)",
  "& .MuiFormControlLabel-label": {
    color: "#083A50",
    fontWeight: "700",
    userSelect: "none",
  },
  "& .MuiCheckbox-root:not(.Mui-disabled)": {
    color: "#005EA2 !important",
  },
});

const HiddenField = styled("input")({
  display: "none",
});

/**
 * Form Section A View
 *
 * @param {FormSectionProps} props
 * @returns {JSX.Element}
 */
const FormSectionA: FC<FormSectionProps> = ({ SectionOption, refs }: FormSectionProps) => {
  const {
    status,
    data: { questionnaireData: data },
    formRef,
  } = useFormContext();
  const { data: institutionList } = useAggregatedInstitutions();
  const location = useLocation();
  const { readOnlyInputs } = useFormMode();
  const { A: SectionAMetadata } = SectionMetadata;

  const [pi, setPi] = useState<PI>(data?.pi);
  const [primaryContact, setPrimaryContact] = useState<Contact>(data?.primaryContact);
  const [piAsPrimaryContact, setPiAsPrimaryContact] = useState<boolean>(
    data?.piAsPrimaryContact || false
  );
  const [additionalContacts, setAdditionalContacts] = useState<KeyedContact[]>(
    data.additionalContacts?.map(mapObjectWithKey) || []
  );

  const formContainerRef = useRef<HTMLDivElement>();
  const { getFormObjectRef } = refs;

  const togglePrimaryPI = () => {
    setPiAsPrimaryContact(!piAsPrimaryContact);
    setPrimaryContact(cloneDeep(InitialQuestionnaire.primaryContact));
  };

  const getFormObject = (): FormObject | null => {
    if (!formRef.current) {
      return null;
    }

    const formObject = parseForm(formRef.current, { nullify: false });
    const combinedData = combineQuestionnaireData(data, formObject);

    if (!formObject.additionalContacts || formObject.additionalContacts.length === 0) {
      combinedData.additionalContacts = [];
    }
    if (formObject.piAsPrimaryContact) {
      combinedData.primaryContact = null;
    }

    combinedData.additionalContacts?.forEach((ac) => unset(ac, "key"));

    return { ref: formRef, data: combinedData };
  };

  const addContact = () => {
    setAdditionalContacts((prev) => [
      ...prev,
      {
        key: `${additionalContacts.length}_${new Date().getTime()}`,
        position: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        institution: "",
        institutionID: "",
      },
    ]);
  };

  const removeContact = (key: string) => {
    setAdditionalContacts((prev) => prev.filter((c) => c.key !== key));
  };

  const handlePIInstitutionChange = (value: string) => {
    const apiData = institutionList.find((i) => i.name === value);
    setPi((prev) => ({
      ...prev,
      institution: apiData?.name || value,
      institutionID: apiData?._id || "",
    }));
  };

  const handlePCInstitutionChange = (value: string) => {
    const apiData = institutionList.find((i) => i.name === value);
    setPrimaryContact((prev) => ({
      ...prev,
      institution: apiData?.name || value,
      institutionID: apiData?._id || "",
    }));
  };

  useEffect(() => {
    getFormObjectRef.current = getFormObject;
  }, [refs]);

  useEffect(() => {
    if (location?.state?.from === "/submission-requests") {
      return;
    }

    formContainerRef.current?.scrollIntoView({ block: "start" });
  }, [location]);

  useEffect(() => {
    setPi(data?.pi);
  }, [data?.pi]);

  useEffect(() => {
    setPrimaryContact(data?.primaryContact);
  }, [data?.primaryContact]);

  useEffect(() => {
    setPiAsPrimaryContact(data?.piAsPrimaryContact || false);
  }, [data?.piAsPrimaryContact]);

  useEffect(() => {
    const incoming = data?.additionalContacts ?? [];
    setAdditionalContacts((prev) =>
      incoming.map((c, i) => ({
        ...c,
        key: prev[i]?.key ?? mapObjectWithKey(c, i).key,
      }))
    );
  }, [data?.additionalContacts]);

  return (
    <FormContainer
      ref={formContainerRef}
      formRef={formRef}
      description={SectionOption.title}
      prefixElement={<PansBanner />}
    >
      {/* Principal Investigator */}
      <SectionGroup
        title={SectionAMetadata.sections.PRINCIPAL_INVESTIGATOR.title}
        description={SectionAMetadata.sections.PRINCIPAL_INVESTIGATOR.description}
      >
        <TextInput
          id="section-a-pi-first-name"
          label="First name"
          name="pi[firstName]"
          value={pi?.firstName}
          placeholder="Enter first name"
          maxLength={50}
          required
          readOnly={readOnlyInputs}
        />
        <TextInput
          id="section-a-pi-last-name"
          label="Last name"
          name="pi[lastName]"
          value={pi?.lastName}
          placeholder="Enter last name"
          maxLength={50}
          required
          readOnly={readOnlyInputs}
        />
        <TextInput
          id="section-a-pi-position"
          label="Position"
          name="pi[position]"
          value={pi?.position}
          placeholder="Enter position"
          maxLength={100}
          required
          readOnly={readOnlyInputs}
        />
        <TextInput
          id="section-a-pi-email"
          type="email"
          label="Email"
          name="pi[email]"
          value={pi?.email}
          placeholder="Enter email"
          validate={validateEmail}
          errorText="Please provide a valid email address"
          required
          readOnly={readOnlyInputs}
        />
        <TextInput
          id="section-a-pi-orcid"
          label="ORCID"
          name="pi[ORCID]"
          value={pi?.ORCID}
          placeholder="e.g. 0000-0001-2345-6789"
          validate={(val) => val?.length === 0 || isValidORCID(val)}
          filter={formatORCIDInput}
          errorText="Please provide a valid ORCID"
          readOnly={readOnlyInputs}
        />
        <AutocompleteInput
          id="section-a-pi-institution"
          label="Institution"
          name="pi[institution]"
          value={pi?.institution || ""}
          options={institutionList?.map((i) => i.name)}
          placeholder="Enter or Select an Institution"
          validate={(v: string) => v?.trim()?.length > 0 && !validateUTF8(v)}
          onChange={(_, val) => handlePIInstitutionChange(val)}
          onInputChange={(_, val, reason) => {
            // NOTE: If reason is not 'input', then the user did not trigger this event
            if (reason === "input") {
              handlePIInstitutionChange(val);
            }
          }}
          required
          disableClearable
          freeSolo
          readOnly={readOnlyInputs}
        />
        <HiddenField
          type="text"
          name="pi[institutionID]"
          value={pi?.institutionID || ""}
          onChange={() => {}}
          data-type="string"
          aria-label="Institution ID field"
          hidden
        />
        <TextInput
          id="section-a-pi-institution-address"
          label="Institution Address"
          value={pi?.address}
          gridWidth={12}
          maxLength={200}
          name="pi[address]"
          placeholder="200 characters allowed"
          rows={4}
          multiline
          required
          readOnly={readOnlyInputs}
        />
      </SectionGroup>

      {/* Primary Contact */}
      <SectionGroup
        title={SectionAMetadata.sections.PRIMARY_CONTACT.title}
        description={SectionAMetadata.sections.PRIMARY_CONTACT.description}
      >
        <Grid item md={12}>
          <StyledFormControlLabel
            label="Same as Principal Investigator"
            control={
              <Checkbox
                checked={piAsPrimaryContact}
                onChange={() => !readOnlyInputs && togglePrimaryPI()}
                readOnly={readOnlyInputs}
              />
            }
            disabled={readOnlyInputs}
          />
          <input
            id="section-a-primary-contact-same-as-pi-checkbox"
            style={{ display: "none" }}
            type="checkbox"
            name="piAsPrimaryContact"
            data-type="boolean"
            value={piAsPrimaryContact?.toString()}
            aria-label="Same as Principal Investigator"
            checked
            readOnly
          />
        </Grid>
        {!piAsPrimaryContact && (
          <>
            <TextInput
              id="section-a-primary-contact-first-name"
              label="First name"
              name="primaryContact[firstName]"
              value={primaryContact?.firstName || ""}
              placeholder="Enter first name"
              maxLength={50}
              readOnly={readOnlyInputs}
              required
            />
            <TextInput
              id="section-a-primary-contact-last-name"
              label="Last name"
              name="primaryContact[lastName]"
              value={primaryContact?.lastName || ""}
              placeholder="Enter last name"
              maxLength={50}
              readOnly={readOnlyInputs}
              required
            />
            <TextInput
              id="section-a-primary-contact-position"
              label="Position"
              name="primaryContact[position]"
              value={primaryContact?.position || ""}
              placeholder="Enter position"
              maxLength={100}
              readOnly={readOnlyInputs}
              required
            />
            <TextInput
              id="section-a-primary-contact-email"
              type="email"
              label="Email"
              name="primaryContact[email]"
              value={primaryContact?.email || ""}
              validate={validateEmail}
              errorText="Please provide a valid email address"
              placeholder="Enter email"
              readOnly={readOnlyInputs}
              required
            />
            <AutocompleteInput
              id="section-a-primary-contact-institution"
              label="Institution"
              name="primaryContact[institution]"
              value={primaryContact?.institution || ""}
              options={institutionList?.map((i) => i.name)}
              placeholder="Enter or Select an Institution"
              readOnly={readOnlyInputs}
              validate={(v: string) => v?.trim()?.length > 0 && !validateUTF8(v)}
              onChange={(_, val) => handlePCInstitutionChange(val)}
              onInputChange={(_, val, reason) => {
                // NOTE: If reason is not 'input', then the user did not trigger this event
                if (reason === "input") {
                  handlePCInstitutionChange(val);
                }
              }}
              disableClearable
              required
              freeSolo
            />
            <HiddenField
              type="text"
              name="primaryContact[institutionID]"
              value={primaryContact?.institutionID || ""}
              onChange={() => {}}
              data-type="string"
              aria-label="Institution ID field"
              hidden
            />
            <TextInput
              id="section-a-primary-contact-phone-number"
              type="tel"
              label="Phone number"
              name="primaryContact[phone]"
              filter={filterForNumbers}
              value={primaryContact?.phone || ""}
              placeholder="Enter phone number"
              maxLength={25}
              readOnly={readOnlyInputs}
            />
          </>
        )}
      </SectionGroup>

      {/* Additional Contacts */}
      <SectionGroup
        title={SectionAMetadata.sections.ADDITIONAL_CONTACTS.title}
        description={SectionAMetadata.sections.ADDITIONAL_CONTACTS.description}
        endButton={
          <AddRemoveButton
            id="section-a-add-additional-contact-button"
            label="Add Contact"
            startIcon={<AddCircleIcon />}
            onClick={addContact}
            disabled={readOnlyInputs || status === FormStatus.SAVING}
          />
        }
      >
        <TransitionGroupWrapper
          items={additionalContacts}
          renderItem={(contact: KeyedContact, idx: number) => (
            <>
              <input
                type="hidden"
                name={`additionalContacts[${idx}][key]`}
                value={contact.key}
                readOnly
              />
              <AdditionalContact
                key={contact.key}
                idPrefix="section-a"
                index={idx}
                contact={contact}
                onDelete={() => removeContact(contact.key)}
                readOnly={readOnlyInputs}
              />
            </>
          )}
        />
      </SectionGroup>
    </FormContainer>
  );
};

export default FormSectionA;
