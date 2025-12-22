import { parseForm } from "@jalik/form-parser";
import { Divider, Grid, Stack, styled } from "@mui/material";
import { cloneDeep } from "lodash";
import { FC, useEffect, useRef, useState } from "react";

import { useFormContext } from "../../../components/Contexts/FormContext";
import ExportRequestButton from "../../../components/ExportRequestButton";
import FormContainer from "../../../components/Questionnaire/FormContainer";
import { repositoryDataTypesOptions } from "../../../components/Questionnaire/Repository";
import ReviewDataListing from "../../../components/Questionnaire/ReviewDataListing";
import ReviewDataListingProperty, {
  StyledValue,
} from "../../../components/Questionnaire/ReviewDataListingProperty";
import ReviewFileTypeTable from "../../../components/Questionnaire/ReviewFileTypeTable";
import ReviewSection from "../../../components/Questionnaire/ReviewSection";
import { StyledDescription } from "../../../components/Questionnaire/SectionGroup";
import DataTypes from "../../../config/DataTypesConfig";
import SectionMetadata from "../../../config/SectionMetadata";
import useFormMode from "../../../hooks/useFormMode";
import { mapObjectWithKey, formatPhoneNumber } from "../../../utils";

import { KeyedContact } from "./A";
import { KeyedFunding, KeyedPlannedPublication, KeyedPublication, KeyedRepository } from "./B";
import { KeyedFileTypeData } from "./D";

const StyledAddress = styled(Stack)(() => ({
  display: "flex",
  flexDirection: "column",
  flexShrink: "0",
  justifyContent: "start",
  "& span": {
    lineHeight: "18px",
  },
}));

const StyledDivider = styled(Divider)(() => ({
  color: "#34A286",
  marginTop: "34px",
  marginBottom: "8px",
}));

/**
 * Form Section Review View
 *
 * @param {FormSectionProps} props
 * @returns {JSX.Element}
 */
const FormSectionReview: FC<FormSectionProps> = ({ SectionOption, refs }: FormSectionProps) => {
  const {
    data: { questionnaireData: data },
    formRef,
  } = useFormContext();
  const { formMode } = useFormMode();
  const { pi, primaryContact, piAsPrimaryContact, program, study } = data;
  const formContainerRef = useRef<HTMLDivElement>();
  const { getFormObjectRef } = refs;

  const [additionalContacts] = useState<KeyedContact[]>(
    data.additionalContacts?.map(mapObjectWithKey) || []
  );
  const [fundingAgencies] = useState<KeyedFunding[]>(
    data.study?.funding?.map(mapObjectWithKey) || []
  );
  const [publications] = useState<KeyedPublication[]>(
    data.study?.publications?.map(mapObjectWithKey) || []
  );
  const [plannedPublications] = useState<KeyedPlannedPublication[]>(
    data.study?.plannedPublications?.map(mapObjectWithKey) || []
  );
  const [repositories] = useState<KeyedRepository[]>(
    data.study?.repositories?.map(mapObjectWithKey) || []
  );
  const [fileTypes] = useState<KeyedFileTypeData[]>(data.files?.map(mapObjectWithKey) || []);
  const [piAddressPart1, ...piAddressPart2] = pi?.address?.split(",") || [];

  const showReviewTitle = formMode === "View Only" || formMode === "Review";

  const getFormObject = (): FormObject | null => {
    if (!formRef.current) {
      return null;
    }

    // TODO – Check if this is necessary? we should be able to reuse the data from the context
    const formObject = parseForm(formRef.current, { nullify: false });
    const combinedData = { ...cloneDeep(data), ...formObject };

    return { ref: formRef, data: combinedData };
  };

  useEffect(() => {
    getFormObjectRef.current = getFormObject;
  }, [refs, formMode]);

  useEffect(() => {
    formContainerRef.current?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <FormContainer
      ref={formContainerRef}
      description={showReviewTitle ? "Review" : SectionOption.title}
      descriptionAdornment={<ExportRequestButton />}
      formRef={formRef}
    >
      {/* Principal Investigator and Contact Information Section */}
      <ReviewSection idPrefix="review-section-a" title={SectionMetadata.A.title}>
        <ReviewDataListing
          idPrefix="review-pi"
          title={SectionMetadata.A.sections.PRINCIPAL_INVESTIGATOR.title}
          description={SectionMetadata.A.sections.PRINCIPAL_INVESTIGATOR.description}
        >
          <ReviewDataListingProperty
            idPrefix="review-pi-name"
            label="Name"
            value={`${pi.lastName}, ${pi.firstName}`}
          />
          <ReviewDataListingProperty
            idPrefix="review-pi-position"
            label="Position"
            value={pi.position}
          />
          <ReviewDataListingProperty
            idPrefix="review-pi-email-address"
            label="Email Address"
            value={pi.email}
          />
          <ReviewDataListingProperty
            idPrefix="review-pi-institution-name"
            label="Institution Name"
            value={pi.institution}
          />
          <ReviewDataListingProperty idPrefix="review-pi-orcid" label="ORCID" value={pi.ORCID} />
          <ReviewDataListingProperty
            idPrefix="review-pi-institution-address"
            label="Institution Address"
            value={
              <StyledAddress>
                <StyledValue>{`${piAddressPart1}${piAddressPart2?.length ? "," : ""}`}</StyledValue>
                <StyledValue>{piAddressPart2.join(",")}</StyledValue>
              </StyledAddress>
            }
          />
        </ReviewDataListing>

        <ReviewDataListing
          idPrefix="review-primary-contact"
          title={SectionMetadata.A.sections.PRIMARY_CONTACT.title}
          description={SectionMetadata.A.sections.PRIMARY_CONTACT.description}
        >
          {piAsPrimaryContact ? (
            <>
              <ReviewDataListingProperty
                idPrefix="review-primary-contact-name"
                label="Primary Contact Name"
                value={`${pi.lastName}, ${pi.firstName}`}
              />
              <ReviewDataListingProperty
                idPrefix="review-primary-contact-position"
                label="Position"
                value={pi.position}
              />
              <ReviewDataListingProperty
                idPrefix="review-primary-contact-email-address"
                label="Email Address"
                value={pi.email}
              />
              <ReviewDataListingProperty
                idPrefix="review-primary-contact-institution-name"
                label="Institution Name"
                value={pi.institution}
              />
              <ReviewDataListingProperty
                idPrefix="review-primary-contact-phone-number"
                label="Phone Number"
                value=""
              />
            </>
          ) : (
            <>
              <ReviewDataListingProperty
                idPrefix="review-primary-contact-name"
                label="Primary Contact Name"
                value={`${primaryContact?.lastName}, ${primaryContact?.firstName}`}
              />
              <ReviewDataListingProperty
                idPrefix="review-primary-contact-position"
                label="Position"
                value={primaryContact?.position}
              />
              <ReviewDataListingProperty
                idPrefix="review-primary-contact-email-address"
                label="Email Address"
                value={primaryContact?.email}
              />
              <ReviewDataListingProperty
                idPrefix="review-primary-contact-institution-name"
                label="Institution Name"
                value={primaryContact?.institution}
              />
              <ReviewDataListingProperty
                idPrefix="review-primary-contact-phone-number"
                label="Phone Number"
                value={formatPhoneNumber(primaryContact?.phone)}
              />
            </>
          )}
        </ReviewDataListing>

        {additionalContacts?.map((additionalContact: KeyedContact, idx: number) => (
          <ReviewDataListing
            key={additionalContact.key}
            idPrefix={`review-additional-contacts-${idx}`}
            title={idx === 0 ? SectionMetadata.A.sections.ADDITIONAL_CONTACTS.title : null}
            description={
              idx === 0 ? SectionMetadata.A.sections.ADDITIONAL_CONTACTS.description : null
            }
          >
            <ReviewDataListingProperty
              idPrefix={`review-additional-contacts-${idx}-name`}
              label="Contact Name"
              value={`${additionalContact.lastName}, ${additionalContact.firstName}`}
            />
            <ReviewDataListingProperty
              idPrefix={`review-additional-contacts-${idx}-position`}
              label="Position"
              value={additionalContact.position}
            />
            <ReviewDataListingProperty
              idPrefix={`review-additional-contacts-${idx}-email-address`}
              label="Email Address"
              value={additionalContact.email}
            />
            <ReviewDataListingProperty
              idPrefix={`review-additional-contacts-${idx}-institution-name`}
              label="Institution Name"
              value={additionalContact.institution}
            />
            <ReviewDataListingProperty
              idPrefix={`review-additional-contacts-${idx}-phone-number`}
              label="Phone Number"
              value={formatPhoneNumber(additionalContact.phone)}
            />
          </ReviewDataListing>
        ))}
      </ReviewSection>

      {/* Program and study information Section */}
      <ReviewSection idPrefix="review-section-b" title={SectionMetadata.B.title}>
        <ReviewDataListing
          idPrefix="review-program-information"
          title={SectionMetadata.B.sections.PROGRAM_INFORMATION.title}
          description={SectionMetadata.B.sections.PROGRAM_INFORMATION.description}
        >
          <ReviewDataListingProperty
            idPrefix="review-program-information-title"
            label="Program Title"
            value={program?.name}
          />
          <ReviewDataListingProperty
            idPrefix="review-program-information-abbreviation"
            label="Program Abbreviation"
            value={program?.abbreviation}
          />
          <ReviewDataListingProperty
            idPrefix="review-program-information-description"
            gridWidth={12}
            label="Program Description"
            value={program?.description}
            valuePlacement="bottom"
          />
        </ReviewDataListing>

        <ReviewDataListing
          idPrefix="review-study-information"
          title={SectionMetadata.B.sections.STUDY_INFORMATION.title}
          description={SectionMetadata.B.sections.STUDY_INFORMATION.description}
        >
          <ReviewDataListingProperty
            idPrefix="review-study-information-title"
            label="Study Title"
            value={study.name}
          />
          <ReviewDataListingProperty
            idPrefix="review-study-information-abbreviation"
            label="Study Abbreviation"
            value={study.abbreviation}
          />
          <ReviewDataListingProperty
            idPrefix="review-study-information-description"
            gridWidth={12}
            label="Study Description"
            value={study.description}
            valuePlacement="bottom"
          />
        </ReviewDataListing>

        {fundingAgencies?.map((fundingAgency: KeyedFunding, idx: number) => (
          <ReviewDataListing
            key={fundingAgency.key}
            idPrefix={`review-funding-agency-${idx}`}
            title={idx === 0 ? SectionMetadata.B.sections.FUNDING_AGENCY.title : null}
            description={idx === 0 ? SectionMetadata.B.sections.FUNDING_AGENCY.description : null}
          >
            <ReviewDataListingProperty
              idPrefix={`review-funding-agency-${idx}-organization`}
              label="Funding Agency/Organization"
              value={fundingAgency.agency}
              valuePlacement="bottom"
            />
            <ReviewDataListingProperty
              idPrefix={`review-funding-agency-${idx}-grant-or-contract-numbers`}
              label="Grant or Contract Number(s)"
              value={fundingAgency.grantNumbers}
              valuePlacement="bottom"
            />
            <ReviewDataListingProperty
              idPrefix={`review-funding-agency-${idx}-nci-program-officer`}
              label="NCI Program Officer"
              value={fundingAgency.nciProgramOfficer}
              valuePlacement="bottom"
            />
          </ReviewDataListing>
        ))}

        {publications?.map((publication: KeyedPublication, idx: number) => (
          <ReviewDataListing
            key={publication.key}
            idPrefix={`review-existing-publication-${idx}`}
            title={idx === 0 ? SectionMetadata.B.sections.EXISTING_PUBLICATIONS.title : null}
            description={
              idx === 0 ? SectionMetadata.B.sections.EXISTING_PUBLICATIONS.description : null
            }
          >
            <ReviewDataListingProperty
              idPrefix={`review-existing-publication-${idx}-title`}
              gridWidth={12}
              label="Publication Title"
              value={publication.title}
              valuePlacement="bottom"
            />
            <ReviewDataListingProperty
              idPrefix={`review-existing-publication-${idx}-pubmed-id-pmid`}
              label="PubMed ID (PMID)"
              value={publication.pubmedID}
            />
            <ReviewDataListingProperty
              idPrefix={`review-existing-publication-${idx}-DOI`}
              label="DOI"
              value={publication.DOI}
            />
          </ReviewDataListing>
        ))}

        {plannedPublications?.map((plannedPublication: KeyedPlannedPublication, idx: number) => (
          <ReviewDataListing
            key={plannedPublication.key}
            idPrefix={`review-planned-publication-${idx}`}
            title={idx === 0 ? SectionMetadata.B.sections.PLANNED_PUBLICATIONS.title : null}
            description={
              idx === 0 ? SectionMetadata.B.sections.PLANNED_PUBLICATIONS.description : null
            }
          >
            <ReviewDataListingProperty
              idPrefix={`review-planned-publication-${idx}-title`}
              gridWidth={12}
              label="Planned Publication Title"
              value={plannedPublication.title}
              valuePlacement="bottom"
            />
            <ReviewDataListingProperty
              idPrefix={`review-planned-publication-${idx}-date`}
              label="Expected Publication Date"
              value={plannedPublication.expectedDate}
            />
          </ReviewDataListing>
        ))}

        {repositories?.map((repository: KeyedRepository, idx: number) => (
          <ReviewDataListing
            key={repository.key}
            idPrefix={`review-repository-${idx}`}
            title={idx === 0 ? SectionMetadata.B.sections.REPOSITORY.title : null}
            description={idx === 0 ? SectionMetadata.B.sections.REPOSITORY.description : null}
          >
            <ReviewDataListingProperty
              idPrefix={`review-repository-${idx}-name`}
              label="Repository Name"
              value={repository.name}
              valuePlacement="bottom"
            />
            <ReviewDataListingProperty
              idPrefix={`review-repository-${idx}-study-id`}
              label="Study ID"
              value={repository.studyID}
              valuePlacement="bottom"
            />
            <ReviewDataListingProperty
              idPrefix={`review-repository-${idx}-data-types-submitted`}
              label="Data Type(s) Submitted"
              value={repository.dataTypesSubmitted?.map(
                (dataType) =>
                  repositoryDataTypesOptions.find((option) => option.name === dataType)?.label
              )}
              valuePlacement="bottom"
              isList
            />
            <ReviewDataListingProperty
              idPrefix={`review-repository-${idx}-other-data-types`}
              label="Other Data Type(s)"
              value={repository.otherDataTypesSubmitted}
              valuePlacement="bottom"
              delimiter="|"
              isList
            />
          </ReviewDataListing>
        ))}
      </ReviewSection>

      {/* Data Access and Disease Information Section */}
      <ReviewSection idPrefix="review-section-c" title={SectionMetadata.C.title}>
        <ReviewDataListing
          idPrefix="review-data-access"
          title={SectionMetadata.C.sections.DATA_ACCESS.title}
          description={SectionMetadata.C.sections.DATA_ACCESS.description}
        >
          <ReviewDataListingProperty
            idPrefix="review-data-access-access-types"
            label="Access Types"
            value={data.accessTypes}
            valuePlacement="bottom"
            isList
          />
        </ReviewDataListing>

        <ReviewDataListing
          idPrefix="review-dbGaP"
          title={SectionMetadata.C.sections.DBGAP_REGISTRATION.title}
          description={SectionMetadata.C.sections.DBGAP_REGISTRATION.description}
        >
          <ReviewDataListingProperty
            idPrefix="review-dbGaP-registration"
            label="HAS YOUR STUDY BEEN REGISTERED IN dbGaP?"
            value={study.isDbGapRegistered ? "Yes" : "No"}
            textTransform="none"
          />
          <ReviewDataListingProperty
            idPrefix="review-dbGaP-phs-number"
            label="dbGaP PHS NUMBER"
            value={study.isDbGapRegistered ? study.dbGaPPPHSNumber : "NA"}
            textTransform="none"
          />
          <ReviewDataListingProperty
            idPrefix="review-genomic-program-administrator-name"
            label="GPA Name"
            value={study.GPAName}
            valuePlacement="bottom"
            gridWidth={12}
          />
        </ReviewDataListing>

        <ReviewDataListing
          idPrefix="review-cancer-types"
          title={SectionMetadata.C.sections.CANCER_TYPES.title}
          description={SectionMetadata.C.sections.CANCER_TYPES.description}
        >
          <ReviewDataListingProperty
            idPrefix="review-cancer-types-cancer-types"
            label="Cancer types"
            value={data.cancerTypes}
            valuePlacement="bottom"
            isList
          />
          <ReviewDataListingProperty
            idPrefix="review-cancer-types-other-cancer-types"
            label="Other cancer type(s)"
            value={data.otherCancerTypes}
            valuePlacement="bottom"
            delimiter="|"
            isList
          />
          <ReviewDataListingProperty
            idPrefix="review-cancer-types-pre-cancer-types"
            label="Pre-cancer types"
            value={data.preCancerTypes}
            valuePlacement="bottom"
            delimiter="|"
            isList
          />
        </ReviewDataListing>

        <ReviewDataListing
          idPrefix="review-subjects"
          title={SectionMetadata.C.sections.SUBJECTS.title}
        >
          <ReviewDataListingProperty
            idPrefix="review-subjects-species"
            label="Species of subjects"
            value={data.species}
            valuePlacement="bottom"
            isList
          />
          <ReviewDataListingProperty
            idPrefix="review-subjects-other-species"
            label="Other Specie(s) involved"
            value={data.otherSpeciesOfSubjects}
            valuePlacement="bottom"
            delimiter="|"
            isList
          />
          <ReviewDataListingProperty
            idPrefix="review-subjects-number-of-subjects-included-in-the-submission"
            label="Number of subjects included in the submission"
            value={data.numberOfParticipants?.toString()}
            valuePlacement="bottom"
          />
        </ReviewDataListing>
      </ReviewSection>

      {/* Data Types Section */}
      <ReviewSection idPrefix="review-section-d" title={SectionMetadata.D.title}>
        <ReviewDataListing
          idPrefix="review-data-delivery"
          title={SectionMetadata.D.sections.DATA_DELIVERY_AND_RELEASE_DATES.title}
        >
          <ReviewDataListingProperty
            idPrefix="review-data-delivery-targeted-data-submission-delivery-date"
            label="Targeted Data Submission Delivery Date"
            value={data.targetedSubmissionDate}
          />
          <ReviewDataListingProperty
            idPrefix="review-data-delivery-expected-publication-date"
            label="Expected Publication Date"
            value={data.targetedReleaseDate}
          />
        </ReviewDataListing>

        <ReviewDataListing
          idPrefix="review-data-types"
          title={SectionMetadata.D.sections.DATA_TYPES.title}
          description={SectionMetadata.D.sections.DATA_TYPES.description}
        >
          <ReviewDataListingProperty
            idPrefix="review-data-types-clinical-trial"
            label={DataTypes.clinicalTrial.label}
            value={data.dataTypes?.includes(DataTypes.clinicalTrial.name) ? "Yes" : "No"}
          />
          <ReviewDataListingProperty
            idPrefix="review-data-types-genomics"
            label={DataTypes.genomics.label}
            value={data.dataTypes?.includes(DataTypes.genomics.name) ? "Yes" : "No"}
          />
          <ReviewDataListingProperty
            idPrefix="review-data-types-imaging"
            label={DataTypes.imaging.label}
            value={data.dataTypes?.includes(DataTypes.imaging.name) ? "Yes" : "No"}
          />
          <ReviewDataListingProperty
            idPrefix="review-data-types-proteomics"
            label={DataTypes.proteomics.label}
            value={data.dataTypes?.includes(DataTypes.proteomics.name) ? "Yes" : "No"}
          />
          {data.dataTypes?.includes(DataTypes.imaging.name) &&
            data.imagingDataDeIdentified !== null && (
              <ReviewDataListingProperty
                idPrefix="review-data-types-imaging-data-de-identified"
                label="Imaging Data de-identified"
                value={data.imagingDataDeIdentified ? "Yes" : "No"}
              />
            )}
          <ReviewDataListingProperty
            idPrefix="review-data-types-other-data-types"
            gridWidth={12}
            label="Other Data types"
            value={data.otherDataTypes}
            valuePlacement="bottom"
            delimiter="|"
            isList
          />
        </ReviewDataListing>

        {data.dataTypes?.includes(DataTypes.clinicalTrial.name) && (
          <ReviewDataListing
            idPrefix="review-clinical-data-types"
            title={SectionMetadata.D.sections.CLINICAL_DATA_TYPES.title}
            description={SectionMetadata.D.sections.CLINICAL_DATA_TYPES.description}
          >
            <ReviewDataListingProperty
              idPrefix="review-clinical-data-types-demographic-data"
              label={DataTypes.demographicData.label}
              value={
                data.clinicalData?.dataTypes?.includes(DataTypes.demographicData.name)
                  ? "Yes"
                  : "No"
              }
            />
            <ReviewDataListingProperty
              idPrefix="review-clinical-data-types-relapse-recurrence-data"
              label={DataTypes.relapseRecurrenceData.label}
              value={
                data.clinicalData?.dataTypes?.includes(DataTypes.relapseRecurrenceData.name)
                  ? "Yes"
                  : "No"
              }
            />
            <ReviewDataListingProperty
              idPrefix="review-clinical-data-types-diagnosis-data"
              label={DataTypes.diagnosisData.label}
              value={
                data.clinicalData?.dataTypes?.includes(DataTypes.diagnosisData.name) ? "Yes" : "No"
              }
            />
            <ReviewDataListingProperty
              idPrefix="review-clinical-data-types-outcome-data"
              label={DataTypes.outcomeData.label}
              value={
                data.clinicalData?.dataTypes?.includes(DataTypes.outcomeData.name) ? "Yes" : "No"
              }
            />
            <ReviewDataListingProperty
              idPrefix="review-clinical-data-types-treatment-data"
              label={DataTypes.treatmentData.label}
              value={
                data.clinicalData?.dataTypes?.includes(DataTypes.treatmentData.name) ? "Yes" : "No"
              }
            />
            <ReviewDataListingProperty
              idPrefix="review-clinical-data-types-biospecimen-data"
              label={DataTypes.biospecimenData.label}
              value={
                data.clinicalData?.dataTypes?.includes(DataTypes.biospecimenData.name)
                  ? "Yes"
                  : "No"
              }
            />
            <ReviewDataListingProperty
              idPrefix="review-clinical-data-types-other-clinical-data-types"
              gridWidth={12}
              label="Other Clinical Data types"
              value={data.clinicalData?.otherDataTypes}
              valuePlacement="bottom"
              delimiter="|"
              isList
            />
            <ReviewDataListingProperty
              idPrefix="review-clinical-data-types-additional-data-in-future"
              label="Additional Data in future"
              value={data.clinicalData?.futureDataTypes ? "Yes" : "No"}
            />
          </ReviewDataListing>
        )}

        <ReviewDataListing
          idPrefix="review-file-types"
          title={SectionMetadata.D.sections.FILE_TYPES.title}
          description={SectionMetadata.D.sections.FILE_TYPES.description}
        >
          <Grid xs={12} item>
            <ReviewFileTypeTable files={fileTypes} />
          </Grid>
        </ReviewDataListing>

        <ReviewDataListing idPrefix="review-subjects">
          <ReviewDataListingProperty
            idPrefix="review-subjects-data-de-identified"
            label="Data de-identified"
            value={data.dataDeIdentified ? "Yes" : "No"}
          />
        </ReviewDataListing>

        <ReviewDataListing
          idPrefix="review-additional-comments"
          title={SectionMetadata.D.sections.ADDITIONAL_COMMENTS.title}
        >
          <ReviewDataListingProperty
            idPrefix="review-subjects-cell-lines"
            label="Cell lines"
            value={data.cellLines ? "Yes" : "No"}
          />
          <ReviewDataListingProperty
            idPrefix="review-subjects-model-systems"
            label="Model systems"
            value={data.modelSystems ? "Yes" : "No"}
          />
          <ReviewDataListingProperty
            idPrefix="review-additional-comments-submitter-comment"
            gridWidth={12}
            value={data.submitterComment}
            label={
              <StyledDescription variant="body1">
                {SectionMetadata.D.sections.ADDITIONAL_COMMENTS.description}
              </StyledDescription>
            }
            textTransform="none"
            valuePlacement="bottom"
          />
        </ReviewDataListing>
      </ReviewSection>

      <StyledDivider data-print="false" />
    </FormContainer>
  );
};

export default FormSectionReview;
