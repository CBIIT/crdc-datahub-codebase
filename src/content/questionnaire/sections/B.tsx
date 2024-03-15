import React, { FC, useEffect, useRef, useState } from "react";
import { parseForm } from "@jalik/form-parser";
import { cloneDeep } from "lodash";
import { styled } from "@mui/material";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import dayjs from "dayjs";
import programOptions, { NotApplicableProgram, OptionalProgram } from "../../../config/ProgramConfig";
import { Status as FormStatus, useFormContext } from "../../../components/Contexts/FormContext";
import FormContainer from "../../../components/Questionnaire/FormContainer";
import SectionGroup from "../../../components/Questionnaire/SectionGroup";
import TextInput from "../../../components/Questionnaire/TextInput";
import Publication from "../../../components/Questionnaire/Publication";
import Repository from "../../../components/Questionnaire/Repository";
import { filterAlphaNumeric, findProgram, mapObjectWithKey, programToSelectOption } from "../../../utils";
import AddRemoveButton from "../../../components/Questionnaire/AddRemoveButton";
import PlannedPublication from "../../../components/Questionnaire/PlannedPublication";
import { InitialQuestionnaire } from "../../../config/InitialValues";
import TransitionGroupWrapper from "../../../components/Questionnaire/TransitionGroupWrapper";
import SwitchInput from "../../../components/Questionnaire/SwitchInput";
import useFormMode from "../../../hooks/useFormMode";
import FundingAgency from "../../../components/Questionnaire/FundingAgency";
import SelectInput from "../../../components/Questionnaire/SelectInput";
import SectionMetadata from "../../../config/SectionMetadata";

const StyledProxyCheckbox = styled("input")({
  display: "none !important"
});

export type KeyedPublication = {
  key: string;
} & Publication;

export type KeyedPlannedPublication = {
  key: string;
} & PlannedPublication;

export type KeyedRepository = {
  key: string;
} & Repository;

export type KeyedFunding = {
  key: string;
} & Funding;

/**
 * Form Section B View
 *
 * @param {FormSectionProps} props
 * @returns {JSX.Element}
 */
const FormSectionB: FC<FormSectionProps> = ({ SectionOption, refs }: FormSectionProps) => {
  const { status, data: { questionnaireData: data } } = useFormContext();
  const { readOnlyInputs } = useFormMode();
  const { B: SectionBMetadata } = SectionMetadata;

  const [program, setProgram] = useState<Program>(data.program);
  const [programOption, setProgramOption] = useState<ProgramOption>(findProgram(data.program));
  const [study] = useState<Study>(data.study);
  const [publications, setPublications] = useState<KeyedPublication[]>(data.study?.publications?.map(mapObjectWithKey) || []);
  const [plannedPublications, setPlannedPublications] = useState<KeyedPlannedPublication[]>(data.study?.plannedPublications?.map(mapObjectWithKey) || []);
  const [repositories, setRepositories] = useState<KeyedRepository[]>(data.study?.repositories?.map(mapObjectWithKey) || []);
  const [fundings, setFundings] = useState<KeyedFunding[]>(data.study?.funding?.map(mapObjectWithKey) || []);
  const [isDbGapRegistered, setIsdbGaPRegistered] = useState<boolean>(data.study?.isDbGapRegistered);
  const [dbGaPPPHSNumber, setDbGaPPPHSNumber] = useState<string>(data.study?.dbGaPPPHSNumber);

  const programKeyRef = useRef(new Date().getTime());
  const formContainerRef = useRef<HTMLDivElement>();
  const formRef = useRef<HTMLFormElement>();
  const {
    nextButtonRef, saveFormRef, submitFormRef, approveFormRef, inquireFormRef, rejectFormRef, getFormObjectRef,
  } = refs;

  useEffect(() => {
    if (!saveFormRef.current || !submitFormRef.current) { return; }

    nextButtonRef.current.style.display = "flex";
    saveFormRef.current.style.display = "flex";
    submitFormRef.current.style.display = "none";
    approveFormRef.current.style.display = "none";
    inquireFormRef.current.style.display = "none";
    rejectFormRef.current.style.display = "none";
    getFormObjectRef.current = getFormObject;
  }, [refs]);

  const getFormObject = (): FormObject | null => {
    if (!formRef.current) { return null; }

    const formObject = parseForm(formRef.current, { nullify: false });
    const combinedData = { ...cloneDeep(data), ...formObject };

    // Reset study if the data failed to load
    if (!formObject.study) {
      combinedData.study = InitialQuestionnaire.study;
    }
    if (!formObject?.study?.dbGaPPPHSNumber) {
      combinedData.study.dbGaPPPHSNumber = "";
    }

    // Reset publications if the user has not entered any publications
    if (!formObject.study.publications || formObject.study.publications.length === 0) {
      combinedData.study.publications = [];
    }

    // Reset repositories if the user has not entered any repositories
    if (!formObject.study.repositories || formObject.study.repositories.length === 0) {
      combinedData.study.repositories = [];
    }

     // Reset planned publications if the user has not entered any planned publications
     // Also reset expectedDate when invalid to avoid form submission unsaved changes warning
    combinedData.study.plannedPublications = combinedData.study.plannedPublications?.map((plannedPublication) => ({
        ...plannedPublication,
        expectedDate: dayjs(plannedPublication.expectedDate).isValid()
          ? plannedPublication.expectedDate
          : "",
      })) || [];

    return { ref: formRef, data: combinedData };
  };

  /**
   * Handles the program change event and updates program/study states
   *
   * @param e event
   * @param value new program title
   * @param r Reason for the event dispatch
   * @returns {void}
   */
  const handleProgramChange = (value: string) => {
    if (programOption?.name === value) {
      return;
    }

    const newProgram = findProgram({ name: value });
    setProgramOption(newProgram);
    programKeyRef.current = new Date().getTime();

    // if not applicable, clear fields and set notApplicable property
    if (newProgram?.name === NotApplicableProgram?.name) {
      setProgram({ name: "", abbreviation: "", description: "", notApplicable: true, isCustom: false });
      return;
    }

    // if "Other", then clear all fields
    if (newProgram?.name === OptionalProgram.name) {
      setProgram({
        name: "",
        abbreviation: "",
        description: "",
        notApplicable: false,
        isCustom: true
      });
      return;
    }

    // otherwise, prefill data from programOptions
    setProgram({
      name: newProgram?.name || "",
      abbreviation: newProgram?.abbreviation || "",
      description: newProgram?.description || "",
      notApplicable: false,
      isCustom: false
    });
  };

  const handleIsDbGapRegisteredChange = (e, checked: boolean) => {
    setIsdbGaPRegistered(checked);
    if (!checked) {
      setDbGaPPPHSNumber("");
    }
  };

  /**
   * Add a empty publication to the publications state
   *
   * @returns {void}
   */
  const addPublication = () => {
    setPublications([
      ...publications,
      { key: `${publications.length}_${new Date().getTime()}`, title: "", pubmedID: "", DOI: "" },
    ]);
  };

  /**
   * Remove a publication from the publications state
   *
   * @param key generated key for the publication
   */
  const removePublication = (key: string) => {
    setPublications(publications.filter((c) => c.key !== key));
  };

  /**
   * Add a empty planned publication to the planned publications state
   *
   * @returns {void}
   */
  const addPlannedPublication = () => {
    setPlannedPublications([
      ...plannedPublications,
      { key: `${plannedPublications.length}_${new Date().getTime()}`, title: "", expectedDate: dayjs().format("MM/DD/YYYY") },
    ]);
  };

  /**
   * Remove a planned publication from the planned publications state
   *
   * @param key generated key for the planned publication
   */
  const removePlannedPublication = (key: string) => {
    setPlannedPublications(plannedPublications.filter((c) => c.key !== key));
  };

  /**
   * Add a empty repository to the repositories state
   *
   * @returns {void}
   */
  const addRepository = () => {
    setRepositories([
      ...repositories,
      { key: `${repositories.length}_${new Date().getTime()}`, name: "", studyID: "", dataTypesSubmitted: [], otherDataTypesSubmitted: "" },
    ]);
  };

  /**
   * Remove a repository from the repositories state
   *
   * @param key generated key for the repository
   */
  const removeRepository = (key: string) => {
    setRepositories(repositories.filter((c) => c.key !== key));
  };

  /**
   * Add a empty funding to the fundings state
   *
   * @returns {void}
   */
  const addFunding = () => {
    setFundings([
      ...fundings,
      { key: `${fundings.length}_${new Date().getTime()}`, agency: "", grantNumbers: "", nciProgramOfficer: "", nciGPA: "" },
    ]);
  };

  /**
   * Remove a funding from the fundings state
   *
   * @param key generated key for the funding
   */
  const removeFunding = (key: string) => {
    setFundings(fundings.filter((f) => f.key !== key));
  };

  useEffect(() => {
    formContainerRef.current?.scrollIntoView({ block: "start" });
  }, []);

  const readOnlyProgram = readOnlyInputs || !programOption?.editable;
  const predefinedProgram = programOption && !programOption.editable && !programOption.notApplicable;

  return (
    <FormContainer
      ref={formContainerRef}
      formRef={formRef}
      description={SectionOption.title}
    >
      {/* Program Registration Section */}
      <SectionGroup
        title={SectionBMetadata.sections.PROGRAM_INFORMATION.title}
        description={SectionBMetadata.sections.PROGRAM_INFORMATION.description}
      >
        <SelectInput
          id="section-b-program"
          label="Program"
          options={programOptions?.map(programToSelectOption)}
          value={programOption?.name}
          onChange={handleProgramChange}
          placeholder="Select a program"
          gridWidth={12}
          tooltipText="The name of the broad administrative group that manages the data collection.  Example - Clinical Proteomic Tumor Analysis Consortium."
          required
          readOnly={readOnlyInputs}
        />
        <TextInput
          key={`program-name-${program?.name}_${programKeyRef.current}`}
          id="section-b-program-title"
          label="Program Title"
          name="program[name]"
          value={predefinedProgram ? programOption?.name : program?.name}
          maxLength={50}
          placeholder="50 characters allowed"
          hideValidation={readOnlyProgram}
          required
          readOnly={readOnlyProgram}
        />
        <TextInput
          key={`program-abbreviation-${program?.abbreviation}_${programKeyRef.current}`}
          id="section-b-program-abbreviation"
          label="Program Abbreviation"
          name="program[abbreviation]"
          value={predefinedProgram ? programOption?.abbreviation : program?.abbreviation}
          filter={(input: string) => filterAlphaNumeric(input, "- ")}
          onChange={(e) => { e.target.value = e.target.value.toUpperCase(); }}
          maxLength={100}
          placeholder="100 characters allowed"
          hideValidation={readOnlyProgram}
          required
          readOnly={readOnlyProgram}
        />
        <TextInput
          key={`program-description-${program?.description}_${programKeyRef.current}`}
          id="section-b-program-description"
          label="Program Description"
          name="program[description]"
          value={predefinedProgram ? programOption?.description : program?.description}
          gridWidth={12}
          maxLength={500}
          placeholder="500 characters allowed"
          minRows={2}
          maxRows={2}
          hideValidation={readOnlyProgram}
          multiline
          required
          readOnly={readOnlyProgram}
        />
        <StyledProxyCheckbox
          value={program?.notApplicable?.toString()}
          onChange={() => { }}
          className="input"
          name="program[notApplicable]"
          type="checkbox"
          data-type="boolean"
          aria-labelledby="section-b-program"
          checked
          readOnly={readOnlyProgram}
        />
        <StyledProxyCheckbox
          value={program?.isCustom?.toString()}
          onChange={() => { }}
          className="input"
          name="program[isCustom]"
          type="checkbox"
          data-type="boolean"
          aria-labelledby="section-b-program"
          checked
          readOnly={readOnlyProgram}
        />
      </SectionGroup>

      {/* Study Registration Section */}
      <SectionGroup
        title={SectionBMetadata.sections.STUDY_INFORMATION.title}
        description={SectionBMetadata.sections.STUDY_INFORMATION.description}
      >
        <TextInput
          id="section-b-study-title"
          label="Study Title"
          name="study[name]"
          value={study.name}
          maxLength={100}
          placeholder="100 characters allowed"
          readOnly={readOnlyInputs}
          hideValidation={readOnlyInputs}
          tooltipText="A descriptive name that will be used to identify the study."
          required
        />
        <TextInput
          id="section-b-study-abbreviation-or-acronym"
          label="Study Abbreviation"
          name="study[abbreviation]"
          value={study.abbreviation}
          filter={(input: string) => filterAlphaNumeric(input, "- ")}
          onChange={(e) => { e.target.value = e.target.value.toUpperCase(); }}
          maxLength={20}
          placeholder="20 characters allowed"
          readOnly={readOnlyInputs}
          hideValidation={readOnlyInputs}
          tooltipText="Provide a short abbreviation or acronym (e.g., NCI-MATCH) for the study."
        />
        <TextInput
          id="section-b-study-description"
          label="Study Description"
          name="study[description]"
          value={study.description}
          gridWidth={12}
          maxLength={2500}
          placeholder="2,500 characters allowed"
          minRows={2}
          maxRows={2}
          readOnly={readOnlyInputs}
          hideValidation={readOnlyInputs}
          required
          multiline
          tooltipText="Describe your study and the data being submitted. Include objectives of the study and provide a brief description of the scientific value of the study."
        />
      </SectionGroup>

      {/* Funding Agency */}
      <SectionGroup
        title={SectionBMetadata.sections.FUNDING_AGENCY.title}
        description={SectionBMetadata.sections.FUNDING_AGENCY.description}
        endButton={(
          <AddRemoveButton
            id="section-b-add-funding-agency-button"
            label="Add Agency"
            startIcon={<AddCircleIcon />}
            onClick={addFunding}
            disabled={readOnlyInputs || status === FormStatus.SAVING}
          />
        )}
      >
        <TransitionGroupWrapper
          items={fundings}
          renderItem={(funding: KeyedFunding, idx: number) => (
            <FundingAgency
              idPrefix="section-b-"
              index={idx}
              funding={funding}
              onDelete={() => removeFunding(funding.key)}
              readOnly={readOnlyInputs}
            />
        )}
        />
      </SectionGroup>

      {/* dbGaP Registration section */}
      <SectionGroup
        title={SectionBMetadata.sections.DBGAP_REGISTRATION.title}
        description={SectionBMetadata.sections.DBGAP_REGISTRATION.description}
      >
        <SwitchInput
          id="section-b-dbGaP-registration"
          label="Has your study been registered in dbGaP?"
          name="study[isDbGapRegistered]"
          required
          value={isDbGapRegistered}
          onChange={handleIsDbGapRegisteredChange}
          isBoolean
          readOnly={readOnlyInputs}
        />
        <TextInput
          id="section-b-if-yes-provide-dbgap-phs-number"
          label="If yes, provide dbGaP PHS number with the version number"
          name="study[dbGaPPPHSNumber]"
          value={dbGaPPPHSNumber}
          onChange={(e) => setDbGaPPPHSNumber(e.target.value || "")}
          maxLength={50}
          placeholder={"Ex/ \"phs002529.v1.p1\". 50 characters allowed"}
          gridWidth={12}
          readOnly={readOnlyInputs || !isDbGapRegistered}
          required={isDbGapRegistered}
        />
      </SectionGroup>

      {/* Existing Publications */}
      <SectionGroup
        title={SectionBMetadata.sections.EXISTING_PUBLICATIONS.title}
        description={SectionBMetadata.sections.EXISTING_PUBLICATIONS.description}
        endButton={(
          <AddRemoveButton
            id="section-b-add-publication-button"
            label="Add Existing Publication"
            startIcon={<AddCircleIcon />}
            onClick={addPublication}
            disabled={readOnlyInputs || status === FormStatus.SAVING}
          />
        )}
      >
        <TransitionGroupWrapper
          items={publications}
          renderItem={(pub: KeyedPublication, idx: number) => (
            <Publication
              idPrefix="section-b-"
              index={idx}
              publication={pub}
              onDelete={() => removePublication(pub.key)}
              readOnly={readOnlyInputs}
            />
          )}
        />
      </SectionGroup>

      {/* Planned Publications */}
      <SectionGroup
        title={SectionBMetadata.sections.PLANNED_PUBLICATIONS.title}
        description={SectionBMetadata.sections.PLANNED_PUBLICATIONS.description}
        endButton={(
          <AddRemoveButton
            id="section-b-add-planned-publication-button"
            label="Add Planned Publication"
            startIcon={<AddCircleIcon />}
            onClick={addPlannedPublication}
            disabled={readOnlyInputs || status === FormStatus.SAVING}
          />
        )}
      >
        <TransitionGroupWrapper
          items={plannedPublications}
          renderItem={(pub: KeyedPlannedPublication, idx: number) => (
            <PlannedPublication
              idPrefix="section-b-"
              index={idx}
              plannedPublication={pub}
              onDelete={() => removePlannedPublication(pub.key)}
              readOnly={readOnlyInputs}
            />
          )}
        />

      </SectionGroup>

      {/* Study Repositories */}
      <SectionGroup
        title={SectionBMetadata.sections.REPOSITORY.title}
        description={SectionBMetadata.sections.REPOSITORY.description}
        endButton={(
          <AddRemoveButton
            id="section-b-add-repository-button"
            label="Add Repository"
            startIcon={<AddCircleIcon />}
            onClick={addRepository}
            disabled={readOnlyInputs || status === FormStatus.SAVING}
          />
        )}
      >
        <TransitionGroupWrapper
          items={repositories}
          renderItem={(repo: KeyedRepository, idx: number) => (
            <Repository
              idPrefix="section-b-"
              index={idx}
              repository={repo}
              onDelete={() => removeRepository(repo.key)}
              readOnly={readOnlyInputs}
            />
          )}
        />
      </SectionGroup>
    </FormContainer>
  );
};

export default FormSectionB;
