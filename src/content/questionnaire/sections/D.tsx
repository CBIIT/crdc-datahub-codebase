import { parseForm } from "@jalik/form-parser";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import RemoveCircleIcon from "@mui/icons-material/RemoveCircle";
import { Table, TableBody, TableCell, TableHead, TableRow, styled } from "@mui/material";
import dayjs from "dayjs";
import { unset } from "lodash";
import React, { FC, useEffect, useRef, useState } from "react";

import AddRemoveButton from "../../../components/AddRemoveButton";
import { Status as FormStatus, useFormContext } from "../../../components/Contexts/FormContext";
import DatePickerInput from "../../../components/Questionnaire/DatePickerInput";
import FormContainer from "../../../components/Questionnaire/FormContainer";
import FormGroupCheckbox from "../../../components/Questionnaire/FormGroupCheckbox";
import RadioYesNoInput from "../../../components/Questionnaire/RadioYesNoInput";
import SectionGroup, { StyledDescription } from "../../../components/Questionnaire/SectionGroup";
import SwitchInput from "../../../components/Questionnaire/SwitchInput";
import TableFileTypeAndExtensionInput from "../../../components/Questionnaire/TableFileTypeAndExtensionInput";
import TableTextInput from "../../../components/Questionnaire/TableTextInput";
import TextInput from "../../../components/Questionnaire/TextInput";
import cellLineModelSystemOptions from "../../../config/CellLineModelSystemConfig";
import { fileTypeOptions } from "../../../config/FileTypeConfig";
import { InitialQuestionnaire } from "../../../config/InitialValues";
import SectionMetadata from "../../../config/SectionMetadata";
import useFormMode from "../../../hooks/useFormMode";
import {
  mapObjectWithKey,
  filterPositiveIntegerString,
  reshapeCheckboxGroupOptions,
  combineQuestionnaireData,
} from "../../../utils";

export type KeyedFileTypeData = {
  key: string;
} & FileInfo;

const TableContainer = styled("div")({
  marginLeft: "12px",
  marginBottom: "24px",
  display: "flex",
  width: "100%",
  border: "1px solid #6B7294",
  borderRadius: "10px",
  overflow: "hidden",
  "& .readOnly": {
    backgroundColor: "#E5EEF4",
    color: "#083A50",
    cursor: "not-allowed",
  },
  "& .MuiTableContainer-root": {
    width: "100%",
    marginLeft: "12px",
    overflowY: "visible",
    height: "200px",
  },
  "& th": {
    color: "#083A50",
    fontSize: "16px",
    fontFamily: "'Nunito', 'Rubik', sans-serif",
    fontWeight: 700,
    lineHeight: "19.6px",
  },
  "& table": {
    overflowY: "visible",
  },
  "& .noBorder": {
    border: "none",
  },
  "& .topRowLast": {
    border: "none",
    padding: "10px 8px",
    textAlign: "center",
  },
  "& .fileTypeTableCell": {
    borderTop: "none",
    borderRight: "1px solid #6B7294",
    borderBottom: "none",
    borderLeft: "none",
    padding: "10px 20px",
    textAlign: "center",
  },
  "& .tableTopRowMiddle": {
    borderTop: "none",
    borderRight: "1px solid #6B7294",
    borderBottom: "none",
    borderLeft: "none",
    padding: "10px 10px",
    textAlign: "center",
  },
  "& .bottomRowMiddle": {
    borderTop: "1px solid #6B7294",
    borderRight: "1px solid #6B7294",
    borderBottom: "none",
    borderLeft: "none",
    padding: "10px 10px",
  },
  "& .bottomRowLast": {
    borderTop: "1px solid #6B7294",
    borderRight: "none",
    borderBottom: "none",
    borderLeft: "none",
    textAlign: "center",
    padding: "10px",
    width: "20px",
    minWidth: "0",
  },
  "& .autoComplete": {
    borderTop: "1px solid #6B7294 !important",
    borderRight: "1px solid #6B7294 !important",
    borderBottom: "none !important",
    borderLeft: "none !important",
    padding: "10px 12px 10px 15px",
    "& .MuiStack-root": {
      width: "auto",
    },
  },
  "& .removeButtonContainer": {
    margin: "auto",
    width: "23px",
    "& .MuiStack-root": {
      width: "auto",
    },
  },
  "& .asterisk": {
    color: "#C93F08",
    marginLeft: "2px",
  },
  "& .MuiButton-startIcon": {
    margin: "0 !important",
  },
});

const InvisibleInput = styled("input")({
  height: 0,
  width: 0,
  padding: 0,
  border: 0,
  display: "block",
});

const FormSectionD: FC<FormSectionProps> = ({ SectionOption, refs }: FormSectionProps) => {
  const {
    status,
    data: { questionnaireData: data },
    formRef,
  } = useFormContext();
  const { readOnlyInputs } = useFormMode();
  const { D: SectionDMetadata } = SectionMetadata;

  const [dataTypes, setDataTypes] = useState<string[]>(data.dataTypes);
  const formContainerRef = useRef<HTMLDivElement>();
  const [dataTypesErrorMsg, setDataTypesErrorMsg] = useState<string>("");
  const [clinicalDataTypesErrorMsg, setClinicalDataTypesErrorMsg] = useState<string>("");
  const dataTypesInputRef = useRef<HTMLInputElement>(null);
  const clinicalDataTypesInputRef = useRef<HTMLInputElement>(null);
  const { getFormObjectRef } = refs;
  const [fileTypeData, setFileTypeData] = useState<KeyedFileTypeData[]>(
    data.files?.map(mapObjectWithKey) || []
  );
  const [cellLineModelSystemCheckboxes, setCellLineModelSystemCheckboxes] = useState<string[]>(
    reshapeCheckboxGroupOptions(cellLineModelSystemOptions, data)
  );
  const isClinical = dataTypes?.includes("clinicalTrial");

  const getFormObject = (): FormObject | null => {
    if (!formRef.current) {
      return null;
    }

    const formObject = parseForm(formRef.current, { nullify: false });
    const combinedData = combineQuestionnaireData(data, formObject);
    // Remove empty strings from dataType arrays
    combinedData.dataTypes = combinedData.dataTypes.filter((str: string) => str !== "");
    // Handle validity for at dataTypes section
    if (combinedData.dataTypes.length !== 0 || combinedData.otherDataTypes !== "") {
      setDataTypesErrorMsg("");
      dataTypesInputRef.current.setCustomValidity("");
    } else {
      setDataTypesErrorMsg("At least one data type is required");
      dataTypesInputRef.current.setCustomValidity("At least one data type is required");
    }

    if (!combinedData.dataTypes.includes("clinicalTrial")) {
      combinedData.clinicalData = InitialQuestionnaire.clinicalData;
    } else {
      combinedData.clinicalData.dataTypes = combinedData.clinicalData.dataTypes.filter(
        (str: string) => str !== ""
      );
    }

    // Handle validity for at clinical data types section
    if (
      combinedData.dataTypes.includes("clinicalTrial") &&
      (combinedData.clinicalData?.dataTypes?.length !== 0 ||
        combinedData.clinicalData?.otherDataTypes !== "")
    ) {
      setClinicalDataTypesErrorMsg("");
      clinicalDataTypesInputRef.current?.setCustomValidity("");
    } else if (combinedData.dataTypes.includes("clinicalTrial")) {
      setClinicalDataTypesErrorMsg("At least one clinical data type is required");
      clinicalDataTypesInputRef.current?.setCustomValidity(
        "At least one clinical data type is required"
      );
    }

    combinedData.targetedReleaseDate = dayjs(formObject.targetedReleaseDate).isValid()
      ? formObject.targetedReleaseDate
      : "";
    combinedData.targetedSubmissionDate = dayjs(formObject.targetedSubmissionDate).isValid()
      ? formObject.targetedSubmissionDate
      : "";
    if (formObject.imagingDataDeIdentified === "true") {
      combinedData.imagingDataDeIdentified = true;
    } else if (formObject.imagingDataDeIdentified === "false") {
      combinedData.imagingDataDeIdentified = false;
    }
    // Override empty file array
    combinedData.files = formObject.files;
    // Overwrite number type. If empty string, convert to null.
    combinedData.files.map((file) => {
      file.count = parseInt(file.count.toString(), 10) || null;

      return file;
    });

    combinedData.files?.forEach((f) => unset(f, "key"));

    return { ref: formRef, data: combinedData };
  };

  const addFileDataType = () => {
    setFileTypeData((prev) => [
      ...prev,
      {
        key: `${fileTypeData.length}_${new Date().getTime()}`,
        type: ``,
        count: null,
        amount: "",
        extension: "",
      },
    ]);
  };

  const removeFileDataType = (key: string) => {
    setFileTypeData((prev) => prev.filter((c) => c.key !== key));
  };

  const handleDataTypesChange = (checked: boolean, value: string) => {
    const updatedDataTypes = checked
      ? [...dataTypes, value]
      : dataTypes.filter((dt) => dt !== value);

    setDataTypes(updatedDataTypes);
  };

  useEffect(() => {
    getFormObjectRef.current = getFormObject;
  }, [refs]);

  useEffect(() => {
    formContainerRef.current?.scrollIntoView({ block: "start" });
  }, []);

  useEffect(() => {
    setDataTypes(data?.dataTypes || []);
  }, [data?.dataTypes]);

  useEffect(() => {
    const incoming = data?.files ?? [];
    setFileTypeData((prev) =>
      incoming.map((c, i) => ({
        ...c,
        key: prev[i]?.key ?? mapObjectWithKey(c, i).key,
      }))
    );
  }, [data?.files]);

  useEffect(() => {
    setCellLineModelSystemCheckboxes(reshapeCheckboxGroupOptions(cellLineModelSystemOptions, data));
  }, [data?.cellLines, data?.modelSystems]);

  return (
    <FormContainer ref={formContainerRef} formRef={formRef} description={SectionOption.title}>
      {/* Data Delivery and Release Dates Section */}
      <SectionGroup title={SectionDMetadata.sections.DATA_DELIVERY_AND_RELEASE_DATES.title}>
        <DatePickerInput
          inputID="section-d-targeted-data-submission-delivery-date"
          label="Targeted Data Submission Delivery Date"
          name="targetedSubmissionDate"
          tooltipText="The date that transfer of data from the submitter to CRDC Submission Portal is expected to begin."
          initialValue={data.targetedSubmissionDate}
          gridWidth={6}
          disablePast
          required
          readOnly={readOnlyInputs}
        />
        <DatePickerInput
          inputID="section-d-expected-publication-date"
          label="Expected Publication Date"
          name="targetedReleaseDate"
          tooltipText="The date that submitters expect any paper using this data will be published."
          initialValue={data.targetedReleaseDate}
          gridWidth={6}
          disablePast
          required
          readOnly={readOnlyInputs}
        />
      </SectionGroup>
      {/* Data Types Section */}
      <SectionGroup
        title={SectionDMetadata.sections.DATA_TYPES.title}
        description={SectionDMetadata.sections.DATA_TYPES.description}
        required
        error={dataTypesErrorMsg}
      >
        <InvisibleInput
          ref={dataTypesInputRef}
          aria-label={SectionDMetadata.sections.DATA_TYPES.title}
        />
        <SwitchInput
          id="section-d-clinical-trial"
          label="Clinical"
          name="dataTypes[]"
          graphQLValue="clinicalTrial"
          value={dataTypes.includes("clinicalTrial")}
          onChange={(_e, checked) => handleDataTypesChange(checked, "clinicalTrial")}
          tooltipText="A research study in which one or more subjects are prospectively assigned to one or more interventions (which may include placebo or other control) to evaluate the effects of those interventions on health-related biomedical outcomes."
          readOnly={readOnlyInputs}
        />
        <SwitchInput
          id="section-d-genomics"
          label="Genomics"
          name="dataTypes[]"
          graphQLValue="genomics"
          value={dataTypes.includes("genomics")}
          tooltipText="The branch of molecular biology concerned with the structure, function, evolution, and mapping of genomes.  Includes data from DNA sequencing, RNA sequencing, mutational analysis, and other experiments focused on genomes."
          readOnly={readOnlyInputs}
          switchSx={{ marginRight: "0px" }}
        />
        <SwitchInput
          id="section-d-imaging"
          label="Imaging"
          name="dataTypes[]"
          graphQLValue="imaging"
          value={dataTypes.includes("imaging")}
          onChange={(e, checked) => handleDataTypesChange(checked, "imaging")}
          toggleContent={
            <RadioYesNoInput
              id="section-d-imaging-de-identified"
              value={data.imagingDataDeIdentified}
              containerWidth="1100px"
              gridWidth={12}
              label="Confirm the imaging data you plan to submit are de-identified"
              name="imagingDataDeIdentified"
              row
              required={dataTypes.includes("imaging")}
              readOnly={readOnlyInputs}
            />
          }
          tooltipText="Medical and experimental images from disciplines such as radiology, pathology, and microscopy."
          readOnly={readOnlyInputs}
        />
        <SwitchInput
          id="section-d-proteomics"
          label="Proteomics"
          graphQLValue="proteomics"
          name="dataTypes[]"
          value={dataTypes.includes("proteomics")}
          tooltipText="Data from the study of the large scale expression and use of proteins."
          readOnly={readOnlyInputs}
          sx={{ paddingBottom: "8px" }}
          switchSx={{ marginRight: "0px" }}
        />
        <TextInput
          id="section-d-other-data-types"
          label="Other Data Type(s)"
          name="otherDataTypes"
          value={data.otherDataTypes}
          placeholder="Other Data Types (Specify)"
          gridWidth={12}
          tooltipText='Data that do not fit in any of the other categories. Enter additional Data Types, separated by pipes ("|").'
          readOnly={readOnlyInputs}
          maxLength={200}
        />
      </SectionGroup>

      {/* Clinical Data Types Section */}
      {isClinical && (
        <SectionGroup
          title={SectionDMetadata.sections.CLINICAL_DATA_TYPES.title}
          description={SectionDMetadata.sections.CLINICAL_DATA_TYPES.description}
          required
          error={clinicalDataTypesErrorMsg}
        >
          <InvisibleInput
            ref={clinicalDataTypesInputRef}
            aria-label={SectionDMetadata.sections.CLINICAL_DATA_TYPES.title}
          />
          <SwitchInput
            id="section-d-demographic-data"
            label="Demographic Data"
            name="clinicalData[dataTypes][]"
            graphQLValue="demographicData"
            value={data.clinicalData.dataTypes.includes("demographicData")}
            tooltipText="Indicate whether demographics information is available for the study (such as age or gender)."
            readOnly={readOnlyInputs}
          />
          <SwitchInput
            id="section-d-relapse-recurrence-data"
            label="Relapse/Recurrence Data"
            name="clinicalData[dataTypes][]"
            graphQLValue="relapseRecurrenceData"
            value={data.clinicalData.dataTypes.includes("relapseRecurrenceData")}
            tooltipText="Relapse/recurrence data refers to information associated with the return of a disease after a period of remission. Indicate whether relapse/recurrence data is available for the study."
            readOnly={readOnlyInputs}
            switchSx={{ marginRight: "0px" }}
          />
          <SwitchInput
            id="section-d-diagnosis-data"
            label="Diagnosis Data"
            name="clinicalData[dataTypes][]"
            graphQLValue="diagnosisData"
            value={data.clinicalData.dataTypes.includes("diagnosisData")}
            tooltipText="Indicate whether diagnosis information is available for the study."
            readOnly={readOnlyInputs}
          />
          <SwitchInput
            id="section-d-outcome-data"
            label="Outcome Data"
            name="clinicalData[dataTypes][]"
            graphQLValue="outcomeData"
            value={data.clinicalData.dataTypes.includes("outcomeData")}
            tooltipText="Outcome data refers to information on a specific result or effect that can be measured. Examples of outcomes include decreased pain, reduced tumor size, and improvement of disease. Indicate whether outcome data is available for the study."
            readOnly={readOnlyInputs}
            switchSx={{ marginRight: "0px" }}
          />
          <SwitchInput
            id="section-d-treatment-data"
            label="Treatment Data"
            name="clinicalData[dataTypes][]"
            graphQLValue="treatmentData"
            value={data.clinicalData.dataTypes.includes("treatmentData")}
            tooltipText="Treatment data refers to information on the action or administration of therapeutic agents to produce an effect that is intended to alter the course of a pathological process. Indicate whether treatment data is available for the study."
            readOnly={readOnlyInputs}
            sx={{ paddingBottom: "8px" }}
          />
          <SwitchInput
            id="section-d-biospecimen-data"
            label="Biospecimen Data"
            name="clinicalData[dataTypes][]"
            graphQLValue="biospecimenData"
            value={data.clinicalData.dataTypes.includes("biospecimenData")}
            tooltipText="Biospecimen data refers to information associated with the biological sample, portion, analyte, or aliquot. Indicate whether biospecimen data is available for the study."
            readOnly={readOnlyInputs}
            switchSx={{ marginRight: "0px" }}
          />
          <TextInput
            id="section-d-clinical-data-other-data-types"
            label="Other Clinical Data Types"
            name="clinicalData[otherDataTypes]"
            value={data.clinicalData.otherDataTypes}
            placeholder="Other clinical data types (Specify)"
            gridWidth={12}
            tooltipText='If there are any additional types of data included with the study not already specified above, describe here. Enter additional Clinical Data Types, separated by pipes ("|").'
            readOnly={readOnlyInputs}
            maxLength={200}
          />
          <SwitchInput
            id="section-d-additional-data-in-future"
            label="Additional Data Types with a future submission?"
            name="clinicalData[futureDataTypes]"
            value={data.clinicalData.futureDataTypes}
            gridWidth={8}
            isBoolean
            readOnly={readOnlyInputs}
            tooltipText="Indicate if there will be additional types of data included with a future submission."
            switchSx={{ marginRight: "72px" }}
          />
        </SectionGroup>
      )}

      {/* File Types Section */}
      <SectionGroup
        title={SectionDMetadata.sections.FILE_TYPES.title}
        description={SectionDMetadata.sections.FILE_TYPES.description}
        beginButton={
          <AddRemoveButton
            id="section-d-add-file-type-button"
            label="Add File Type"
            startIcon={<AddCircleIcon />}
            onClick={addFileDataType}
            disabled={readOnlyInputs || status === FormStatus.SAVING}
          />
        }
      >
        <TableContainer>
          <Table className="noBorder">
            <TableHead className="noBorder">
              <TableRow className="noBorder">
                <TableCell width="25%" className="fileTypeTableCell">
                  File Type
                  <span className="asterisk">*</span>
                </TableCell>
                <TableCell width="24%" className="fileTypeTableCell">
                  File Extension
                  <span className="asterisk">*</span>
                </TableCell>
                <TableCell width="15%" className="tableTopRowMiddle">
                  Number of files
                  <span className="asterisk">*</span>
                </TableCell>
                <TableCell width="20%" className="tableTopRowMiddle">
                  Estimated data size
                  <span className="asterisk">*</span>
                </TableCell>
                <TableCell width="5%" className="topRowLast">
                  Remove
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fileTypeData.map((fileData: KeyedFileTypeData, idx: number) => (
                <TableRow key={fileData.key} className={`${readOnlyInputs ? "readOnly" : ""}`}>
                  <TableFileTypeAndExtensionInput
                    inputID={`section-d-file-type-${idx}-file`}
                    typeValue={fileData.type}
                    extensionValue={fileData.extension}
                    name={`files[${idx}]`}
                    options={fileTypeOptions.map((fileType) => fileType)}
                  />
                  <TableCell className="bottomRowMiddle">
                    <input
                      type="hidden"
                      name={`files[${idx}][key]`}
                      value={fileData.key}
                      readOnly
                    />
                    <TableTextInput
                      id={`section-d-file-type-${idx}-number-of-files`}
                      name={`files[${idx}][count]`}
                      value={fileData.count ?? ""}
                      placeholder="Enter file count"
                      inputProps={{ "aria-label": "File count" }}
                      pattern="^[1-9]\d*$"
                      filter={filterPositiveIntegerString}
                      patternValidityMessage="Please enter a whole number greater than 0"
                      maxLength={10}
                      required
                    />
                  </TableCell>
                  <TableCell className="bottomRowMiddle">
                    <TableTextInput
                      id={`section-d-file-type-${idx}-amount-of-data`}
                      name={`files[${idx}][amount]`}
                      value={fileData.amount}
                      placeholder="E.g. 500 GB"
                      inputProps={{ "aria-label": "File size" }}
                      maxLength={50}
                      required
                    />
                  </TableCell>
                  <TableCell className="bottomRowLast">
                    {idx !== 0 ? (
                      <div className="removeButtonContainer">
                        <AddRemoveButton
                          id={`section-d-file-type-${idx}-remove-file-type-button`}
                          placement="start"
                          onClick={() => removeFileDataType(fileData.key)}
                          startIcon={<RemoveCircleIcon />}
                          iconColor="#E74040"
                          disabled={readOnlyInputs || status === FormStatus.SAVING}
                          aria-label="Remove File Type"
                          sx={{ minWidth: "0px !important" }}
                        />
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <RadioYesNoInput
          id="section-d-data-de-identified"
          name="dataDeIdentified"
          label="Confirm the data you plan to submit are de-identified"
          value={data.dataDeIdentified}
          gridWidth={12}
          row
          required
          readOnly={readOnlyInputs}
        />
      </SectionGroup>

      {/* Additional Information Section */}
      <SectionGroup title={SectionDMetadata.sections.ADDITIONAL_COMMENTS.title} description={" "}>
        <FormGroupCheckbox
          idPrefix="section-c-"
          label="Cell lines, model systems (select all that apply or neither)"
          options={cellLineModelSystemOptions}
          value={cellLineModelSystemCheckboxes}
          onChange={(val: string[]) => setCellLineModelSystemCheckboxes(val)}
          orientation="horizontal"
          gridWidth={12}
          readOnly={readOnlyInputs}
        />
        <TextInput
          name="submitterComment"
          label={
            <StyledDescription variant="body1">
              {SectionDMetadata.sections.ADDITIONAL_COMMENTS.description}
            </StyledDescription>
          }
          value={data.submitterComment}
          gridWidth={12}
          maxLength={500}
          placeholder="500 characters allowed"
          minRows={5}
          multiline
          readOnly={readOnlyInputs}
          inputProps={{
            "aria-label": SectionDMetadata.sections.ADDITIONAL_COMMENTS.title,
          }}
        />
      </SectionGroup>
    </FormContainer>
  );
};

export default FormSectionD;
