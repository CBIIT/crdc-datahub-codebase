import { Link } from "react-router-dom";

/**
 * Metadata for Questionnaire Sections
 *
 * @see SectionConfig
 */
const sectionMetadata = {
  A: {
    title: "Principal Investigator and Contact",
    id: "A",
    sections: {
      PRINCIPAL_INVESTIGATOR: {
        title: "PRINCIPAL INVESTIGATOR",
        description:
          "Provide the Principal Investigator contact information for the study or collection.",
      },
      PRIMARY_CONTACT: {
        title: "PRIMARY CONTACT",
        description:
          "Provide the contact information for the primary contact who will be assisting with data submission, if different from PI.",
      },
      ADDITIONAL_CONTACTS: {
        title: "ADDITIONAL CONTACTS",
        description:
          "If there are additional points of contact (e.g., scientific and/or technical data coordinator), enter the contact details for each. If there is more than one, you may add additional rows for the details for each contact.",
      },
    },
  },
  B: {
    title: "Program and Study",
    id: "B",
    sections: {
      PROGRAM_INFORMATION: {
        title: "PROGRAM INFORMATION",
        description:
          "If your study is part of a larger program, enter the program name(s) and/or organization(s) that funded this study.",
      },
      STUDY_INFORMATION: {
        title: "STUDY INFORMATION",
        description: "A short description of the effort that these data have been collected for.",
      },
      FUNDING_AGENCY: {
        title: "FUNDING AGENCY/ORGANIZATION",
        description: "List the agency(s) and/or organization(s) that funded this study.",
      },
      EXISTING_PUBLICATIONS: {
        title: "EXISTING PUBLICATIONS",
        description:
          "List existing publications associated with this study, include PubMed ID (PMID), DOI.",
      },
      PLANNED_PUBLICATIONS: {
        title: "PLANNED PUBLICATIONS",
        description:
          "List planned publications and/or pre-prints associated with this study, if any, and the estimated publication date.",
      },
      REPOSITORY: {
        title: "REPOSITORY",
        description: "Add repository if your data has been submitted to another repository",
      },
    },
  },
  C: {
    title: "Data Access and Disease",
    id: "C",
    sections: {
      DATA_ACCESS: {
        title: "DATA ACCESS",
        description: (
          <>
            Informed consent is the basis for institutions submitting data to determine the
            appropriateness of submitting human data to open or controlled-access NIH/NCI data
            repositories. This refers to how CRDC data repositories distribute scientific data to
            the public. The controlled-access studies are required to submit an Institutional
            Certification to NIH. Learn about this at{" "}
            <Link
              to="https://sharing.nih.gov/genomic-data-sharing-policy/institutional-certifications"
              target="_blank"
            >
              https://sharing.nih.gov/
              <wbr />
              genomic-data-sharing-policy/institutional-certifications
            </Link>
          </>
        ),
      },
      DBGAP_REGISTRATION: {
        title: "dbGaP REGISTRATION",
        description: "Please indicate if your study is currently registered with dbGaP.",
      },
      CANCER_TYPES: {
        title: "CANCER TYPES",
        description:
          "Select the types of cancer(s) and, if applicable, pre-cancer(s) being studied. Multiple cancer types may be selected.",
      },
      SUBJECTS: {
        title: "SUBJECTS/SPECIES",
      },
    },
  },
  D: {
    title: "Data Types",
    id: "D",
    sections: {
      DATA_DELIVERY_AND_RELEASE_DATES: {
        title: "DATA DELIVERY AND RELEASE DATES",
      },
      DATA_TYPES: {
        title: "DATA TYPES",
        description:
          "Indicate the major types of data included in this submission. For each type listed, select Yes or No. Describe any additional major types of data in Other (specify). At least one data type is required.",
      },
      CLINICAL_DATA_TYPES: {
        title: "CLINICAL DATA TYPES",
        description:
          "If 'Clinical' data will be submitted, please provide more details about what types of clinical data will be included. Indicate Yes or No for each type listed below. Describe any additional data types in Other(specify).",
      },
      FILE_TYPES: {
        title: "FILE TYPES",
        description: (
          <>
            List the number, size, and formats of files in the submission in the table below.
            <br />
            Indicate one file type per row. At least one file type is required.
          </>
        ),
      },
      ADDITIONAL_COMMENTS: {
        title: "ADDITIONAL INFORMATION",
        description: "Additional Comments or Information about this submission.",
      },
    },
  },
  REVIEW: {
    title: "Review and Submit",
    id: "review",
  },
};

export default sectionMetadata;
