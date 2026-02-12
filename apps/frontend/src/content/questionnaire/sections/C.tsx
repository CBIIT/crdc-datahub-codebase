import { parseForm } from "@jalik/form-parser";
import { AutocompleteChangeReason, styled } from "@mui/material";
import { FC, SyntheticEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useFormContext } from "../../../components/Contexts/FormContext";
import CustomAutocomplete from "../../../components/Questionnaire/CustomAutocomplete";
import FormContainer from "../../../components/Questionnaire/FormContainer";
import FormGroupCheckbox from "../../../components/Questionnaire/FormGroupCheckbox";
import LabelCheckbox from "../../../components/Questionnaire/LabelCheckbox";
import SectionGroup from "../../../components/Questionnaire/SectionGroup";
import SelectInput from "../../../components/Questionnaire/SelectInput";
import SwitchInput from "../../../components/Questionnaire/SwitchInput";
import TextInput from "../../../components/Questionnaire/TextInput";
import accessTypesOptions from "../../../config/AccessTypesConfig";
import cancerTypeOptions, { CUSTOM_CANCER_TYPES } from "../../../config/CancerTypesConfig";
import SectionMetadata from "../../../config/SectionMetadata";
import speciesOptions from "../../../config/SpeciesConfig";
import useFormMode from "../../../hooks/useFormMode";
import {
  isValidInRange,
  filterPositiveIntegerString,
  combineQuestionnaireData,
  validatePHSNumber,
} from "../../../utils";

const StyledLink = styled(Link)({
  color: "#005A9E",
  fontSize: "16px",
  fontWeight: 700,
  lineHeight: "19.6px",
  marginLeft: "10px",
});

const GPAList = () => (
  <StyledLink
    to="https://sharing.nih.gov/genomic-data-sharing-policy/resources/contacts-and-help#gds_support"
    target="_blank"
    rel="noopener noreferrer"
  >
    View GPA List
  </StyledLink>
);

const AccessTypesDescription = styled("span")(() => ({
  fontWeight: 400,
}));

/**
 * Form Section C View
 *
 * @param {FormSectionProps} props
 * @returns {JSX.Element}
 */
const FormSectionC: FC<FormSectionProps> = ({ SectionOption, refs }: FormSectionProps) => {
  const {
    data: { questionnaireData: data },
    formRef,
  } = useFormContext();
  const { readOnlyInputs } = useFormMode();
  const formContainerRef = useRef<HTMLDivElement>();
  const { getFormObjectRef } = refs;
  const { C: SectionCMetadata } = SectionMetadata;

  const [cancerTypes, setCancerTypes] = useState<string[]>(data.cancerTypes || []);
  const [otherCancerTypes, setOtherCancerTypes] = useState<string>(data.otherCancerTypes);
  const [otherCancerTypesEnabled, setOtherCancerTypesEnabled] = useState<boolean>(
    data.otherCancerTypesEnabled
  );
  const [otherSpecies, setOtherSpecies] = useState<string>(data.otherSpeciesOfSubjects);
  const [otherSpeciesEnabled, setOtherSpeciesEnabled] = useState<boolean>(data.otherSpeciesEnabled);
  const [isDbGapRegistered, setIsdbGaPRegistered] = useState<boolean>(
    data.study?.isDbGapRegistered
  );
  const [dbGaPPPHSNumber, setDbGaPPPHSNumber] = useState<string>(data.study?.dbGaPPPHSNumber);
  const [GPAName, setGPAName] = useState<string>(data.study?.GPAName);

  const getFormObject = (): FormObject | null => {
    if (!formRef.current) {
      return null;
    }

    const formObject = parseForm(formRef.current, { nullify: false });
    const combinedData: QuestionnaireData = combineQuestionnaireData(data, formObject);

    combinedData.numberOfParticipants = parseInt(formObject.numberOfParticipants, 10) || null;

    return { ref: formRef, data: combinedData };
  };

  const handleCancerTypesChange = (
    e: SyntheticEvent,
    newValue: string[],
    reason: AutocompleteChangeReason
  ) => {
    // If N/A was previously selected, then remove N/A
    if (cancerTypes.includes(CUSTOM_CANCER_TYPES.NOT_APPLICABLE)) {
      newValue = newValue.filter((option) => option !== CUSTOM_CANCER_TYPES.NOT_APPLICABLE);
      // If N/A is newly selected, then unselect all other options
    } else if (newValue.includes(CUSTOM_CANCER_TYPES.NOT_APPLICABLE)) {
      newValue = [CUSTOM_CANCER_TYPES.NOT_APPLICABLE];
    }

    if (newValue?.includes(CUSTOM_CANCER_TYPES.NOT_APPLICABLE)) {
      setOtherCancerTypes("");
      setOtherCancerTypesEnabled(false);
    }

    setCancerTypes(newValue);
  };

  const handleOtherCancerTypesCheckboxChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    checked: boolean
  ) => {
    if (!checked) {
      setOtherCancerTypes("");
    }

    setOtherCancerTypesEnabled(checked);
  };

  const handleOtherSpeciesCheckboxChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    checked: boolean
  ) => {
    if (!checked) {
      setOtherSpecies("");
    }

    setOtherSpeciesEnabled(checked);
  };

  const handleIsDbGapRegisteredChange = (e, checked: boolean) => {
    setIsdbGaPRegistered(checked);
    if (!checked) {
      setDbGaPPPHSNumber("");
    }
  };

  useEffect(() => {
    getFormObjectRef.current = getFormObject;
  }, [refs]);

  useEffect(() => {
    formContainerRef.current?.scrollIntoView({ block: "start" });
  }, []);

  useEffect(() => {
    setCancerTypes(data?.cancerTypes || []);
  }, [data?.cancerTypes]);

  useEffect(() => {
    setOtherCancerTypes(data?.otherCancerTypes);
  }, [data?.otherCancerTypes]);

  useEffect(() => {
    setOtherCancerTypesEnabled(data?.otherCancerTypesEnabled);
  }, [data?.otherCancerTypesEnabled]);

  useEffect(() => {
    setOtherSpecies(data?.otherSpeciesOfSubjects);
  }, [data?.otherSpeciesOfSubjects]);

  useEffect(() => {
    setOtherSpeciesEnabled(data?.otherSpeciesEnabled);
  }, [data?.otherSpeciesEnabled]);

  useEffect(() => {
    setIsdbGaPRegistered(data?.study?.isDbGapRegistered);
  }, [data?.study?.isDbGapRegistered]);

  useEffect(() => {
    setDbGaPPPHSNumber(data?.study?.dbGaPPPHSNumber);
  }, [data?.study?.dbGaPPPHSNumber]);

  useEffect(() => {
    setGPAName(data?.study?.GPAName);
  }, [data?.study?.GPAName]);

  return (
    <FormContainer ref={formContainerRef} formRef={formRef} description={SectionOption.title}>
      {/* Data Access Section */}
      <SectionGroup
        title={SectionCMetadata.sections.DATA_ACCESS.title}
        description={SectionCMetadata.sections.DATA_ACCESS.description}
      >
        <FormGroupCheckbox
          idPrefix="section-c-access-types"
          label={
            <>
              Access Types <AccessTypesDescription>(Select all that apply):</AccessTypesDescription>
            </>
          }
          name="accessTypes"
          options={accessTypesOptions}
          value={data.accessTypes}
          gridWidth={12}
          required
          readOnly={readOnlyInputs}
        />
      </SectionGroup>

      {/* dbGaP Registration section */}
      <SectionGroup
        title={SectionCMetadata.sections.DBGAP_REGISTRATION.title}
        description={SectionCMetadata.sections.DBGAP_REGISTRATION.description}
      >
        <SwitchInput
          id="section-c-dbGaP-registration"
          label="Has your study been registered in dbGaP?"
          name="study[isDbGapRegistered]"
          required
          value={isDbGapRegistered}
          onChange={handleIsDbGapRegisteredChange}
          isBoolean
          readOnly={readOnlyInputs}
        />
        <TextInput
          id="section-c-if-yes-provide-dbgap-phs-number"
          label="If yes, provide dbGaP PHS number with the version number"
          name="study[dbGaPPPHSNumber]"
          value={dbGaPPPHSNumber}
          onChange={(e) => setDbGaPPPHSNumber(e.target.value || "")}
          validate={validatePHSNumber}
          errorText="Please provide a valid dbGaP PHS number"
          maxLength={50}
          placeholder='Ex/ "phs002529.v1.p1". 50 characters allowed'
          gridWidth={12}
          readOnly={readOnlyInputs || !isDbGapRegistered}
          required={isDbGapRegistered}
        />

        <TextInput
          id="section-c-genomic-program-administrator-name"
          label="GPA Name"
          labelEndAdornment={<GPAList />}
          name="study[GPAName]"
          value={GPAName}
          onChange={(e) => setGPAName(e.target.value || "")}
          placeholder="Enter GPA Name, if applicable"
          tooltipText="Provide information on the Genomic Program Administrator (GPA) who registered the study on dbGaP."
          gridWidth={12}
          readOnly={readOnlyInputs}
        />
      </SectionGroup>

      {/* Cancer Types Section */}
      <SectionGroup
        title={SectionCMetadata.sections.CANCER_TYPES.title}
        description={SectionCMetadata.sections.CANCER_TYPES.description}
      >
        <CustomAutocomplete
          multiple
          options={cancerTypeOptions}
          disableClearable
          id="section-c-cancer-types"
          label="Cancer types (select all that apply)"
          name="cancerTypes"
          placeholder="Select cancer types"
          value={Array.isArray(cancerTypes) ? cancerTypes : []}
          onChange={handleCancerTypesChange}
          tagText={(value) => `${value.length} Cancer Types selected`}
          readOnly={readOnlyInputs}
          disableCloseOnSelect
        />
        <TextInput
          id="section-c-other-cancer-types"
          key={`other_cancer_types_${cancerTypes?.toString()}`}
          label="Other cancer type(s)"
          tooltipText='Enter additional Cancer Types, separated by pipes ("|").'
          labelStartAdornment={
            <LabelCheckbox
              idPrefix="section-c-other-cancer-types-enabled"
              name="otherCancerTypesEnabled"
              checked={otherCancerTypesEnabled}
              onChange={handleOtherCancerTypesCheckboxChange}
              readOnly={cancerTypes.includes(CUSTOM_CANCER_TYPES.NOT_APPLICABLE) || readOnlyInputs}
              inputProps={{ "aria-label": "Toggle Other cancer type(s)" }}
            />
          }
          name="otherCancerTypes"
          placeholder="Specify other cancer type(s)"
          value={otherCancerTypes}
          onChange={(e) => setOtherCancerTypes(e.target.value || "")}
          maxLength={1000}
          required={otherCancerTypesEnabled}
          readOnly={!otherCancerTypesEnabled || readOnlyInputs}
        />

        <TextInput
          id="section-c-pre-cancer-types"
          label="Pre-Cancer types (provide all that apply)"
          tooltipText='Enter additional Pre-Cancer Types, separated by pipes ("|").'
          name="preCancerTypes"
          placeholder="Provide pre-cancer types"
          value={data.preCancerTypes}
          maxLength={500}
          readOnly={readOnlyInputs}
        />
      </SectionGroup>

      {/* Subjects/Species Section */}
      <SectionGroup title={SectionCMetadata.sections.SUBJECTS.title}>
        <SelectInput
          id="section-c-species-of-subjects"
          label="Species of subjects (choose all that apply)"
          name="species"
          options={speciesOptions.map((option) => ({
            label: option,
            value: option,
          }))}
          placeholder="Select species"
          value={data.species}
          multiple
          required
          readOnly={readOnlyInputs}
        />
        <TextInput
          id="section-c-other-species-of-subjects"
          label="Other Specie(s) involved"
          tooltipText='Enter additional Species, separated by pipes ("|").'
          labelStartAdornment={
            <LabelCheckbox
              idPrefix="section-c-other-cancer-types-enabled"
              name="otherSpeciesEnabled"
              checked={otherSpeciesEnabled}
              onChange={handleOtherSpeciesCheckboxChange}
              readOnly={readOnlyInputs}
              inputProps={{ "aria-label": "Toggle Other Specie(s) involved" }}
            />
          }
          name="otherSpeciesOfSubjects"
          placeholder="Specify all other species (max of 500 characters)"
          value={otherSpecies}
          onChange={(e) => setOtherSpecies(e.target.value || "")}
          maxLength={500}
          required={otherSpeciesEnabled}
          readOnly={!otherSpeciesEnabled || readOnlyInputs}
        />
        <TextInput
          id="section-c-number-of-subjects-included-in-the-submission"
          label="Number of subjects included in the submission"
          name="numberOfParticipants"
          placeholder="##"
          type="text"
          value={data.numberOfParticipants}
          filter={filterPositiveIntegerString}
          validate={(input: string) => isValidInRange(input, 1, 2000000000)} // between 1 and 2bn
          errorText="Value must be between 1 and 2,000,000,000."
          maxLength={10}
          inputProps={
            {
              "data-type": "number",
            } as unknown
          }
          required
          readOnly={readOnlyInputs}
        />
      </SectionGroup>
    </FormContainer>
  );
};

export default FormSectionC;
