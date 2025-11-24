# Release Notes

## 3.4.1 (Released 11/24/2025)

This production patch includes critical fixes to resolve data submission issues affecting metadata display and validation.

#### Bug Fixes

- **Resolved Metadata Row Count Display Issue**\
  Fixed incorrect rounding of metadata entries to thousands in donut charts and Data View tables, ensuring accurate display and download of participant, program, and study node data.
- **Resolved False Duplicate ID Validation Errors**\
  Corrected validation service to properly handle many-to-many relationship data, preventing false "Duplicated IDs" errors during data submission validation.

## 3.4.0 (Released 10/24/2025)

#### Submission Request

- Users can now import/export Submission Request form with Excel templates, enabling offline completion and transfer between requests.
- Requests can be approved but flagged as pending on Data Model changes.
- Requests can be conditionally approved without GPA information.
- Empty requests are permanently deleted when canceled or auto-deleted due to inactivity.
- OMB messages can be updated without code deployment for faster compliance updates.
- Added tooltip guidance when the ‘Next ‘button is disabled on the final form page, directing users to save first.

#### Data Submission

- The system blocks the creation of a data submission if any of the following conditions are pending: missing dbGaP ID, missing GPA, or required Data Model changes.
- Submitters can now edit the name of the existing data submissions.
- Data Commons Personnel can update both the owner and the data model version of a data submission in a single action.
- New Data Explorer lets users view released study metadata and download completed metadata.
- dbGaP loading sheets are available for released submissions (GC Commons only in this release).
- Submitters can now review a summary before submitting their data submission.
- Data Submission must include participant-level dbGaP consent codes for controlled-access studies.
- Submitters can now request new permissible values directly from validation results when “Value not Permitted” error occur.
- “NA” is now supported as a valid Program Full Name/Short Name.
- Submitters’ or collaborators’ access is automatically revoked when their study-level access is removed.
- Record counts for are aligned between aggregated and expanded validation Results views.
- Data Submission Dashboard loading performance has been further improved.

#### Uploader CLI Tool

- Improved log messages for batch uploads when files were already uploaded.
- .zip archives are now supported for data file uploads and are validated with required manifest files.
- Submitters must now specify the archive manifest file location in the CLI configuration download dialog for .zip uploads.

#### Data Commons

- dbGaP consent codes are included in released submission packages and DCF manifests for controlled-access studies.

#### User Account Management

- Permissions and email notification details removed from external user profiles.

#### Email Notifications

- Updated: Conditionally approved request notifications now include all pending conditions.
- New: Email triggered when all pending conditions are resolved and submission can proceed.
- New: Email triggered when Data Concierge updates submission configurations.
- New: Email triggered when submitters request new permissible values.

#### Data Model Navigator

- Permissible values are now displayed in alphabetical order.
- CDE configurations for each property remain visible even when MDB results are unavailable.

#### Internal & Administrative Tools

- Migrated Submission Portal/MDB integration to pull CDE permissible values from the API instead of GitHub
- Admins can clear studies pending data model updates so submissions can begin.
- Institution dropdown in Edit User tool enhanced with auto-complete and case-insensitive search.
- Manage Users search now supports user name and email.
- Manage Programs search now supports name and abbreviation.
- View permissions automatically enabled when required by higher-level roles.

#### System Performance & Technical Improvements

- Program, Study, Institution, and User Name updates automatically sync across associated submissions.
- ORM abstraction layer introduced for more efficient database operations across modules.

## 3.3.1 (Released 08/01/2025)

This production patch includes a critical fix to ensure reliable uploading of large data files using the CLI.

#### Bug Fixes

- **Resolved CLI Upload Timeout for Large Files**\
  Improved the CLI upload process to prevent interruptions when submitting large files (e.g., 500GB or more).

## 3.3.0 (Released 07/09/2025)

#### Submission Request

- Users must provide consent before initiating a submission request.
- Requests can now be canceled directly from within the form.
- A reason is required when canceling or restoring a request.
- User Experience - Improved visual distinction between 'Yes' and 'No' selections.

#### Data Submission

- Enhanced data update functionality with clearer new vs. existing data comparison and overwrite options.
- The system now automatically creates composite key fields in data submissions.
- Data Curators can now update the Data Model Version for existing submissions upon request.
- System now accepts file names that include sub-folder paths.
- Validation - Changing the Data Model Version now automatically resets existing validation results.
- Validation - The system now enforces a consistent file ID format.
- Validation - Studies without a program are now assigned to ‘NA’ and will fail validation if a program node is submitted.
- Validation – Support string pattern validation in data submissions, such as dbGaPID.
- Validation – The system now accepts case-insensitive input for permissive values in data submissions.
- Validation – The system now validates submitted Program and Study Names against the official names maintained by the system.
- The system now supports multiple parent nodes in list format.
- Submitters can now download the metadata files they originally uploaded.
- The Data file size info is now provided for each data submission.
- Users can now view standard node category mappings for each data model in the Data Model Navigator.
- Provides a reason when the "Submit" button is disabled.
- The Data Submission Dashboard now displays full Program and Study names for reference.
- Improved visual distinction of data upload status in the Data Activities tab.
- The term “Primary Contact” for data submission has been renamed to “Data Concierge”.

#### Data Commons

- Generated TSV Metadata files for Downstream Commons now include Concept Codes.
- A comprehensive release package manifest is now included with data submission releases to the downstream Data Commons.

#### Uploader CLI Tool Enhancements

- Automatically injects file IDs into child node templates.
- Detects and reports crashes to accurately reflect upload status.
- Improved support for backward compatibility checks.

#### Email Notifications

- New – Trigger an Email notification to Data Commons Personnel when a Data Submission is created.
- Update - Update content of Request Access email notification to include more information.

#### User Account Management

- Users requesting the Submitter role must now provide their host institution.
- User profiles now display more information, including permissions and email notification settings.
- Federal Leads can now manage other Federal Lead accounts.
- NIH account users are no longer auto-deactivated due to inactivity.

#### Internal & Administrative Tooling

- Operations Dashboard – Added data submission metrics by institutions.
- Operations Dashboard – Added interactive charts with click-to-drilldown functionality.
- Displays a warning when removing the 'Data Commons Personnel' role from a user.
- Manage Studies – Enhanced to display additional study information.
- Introduced a new Manage Institutions tool.
- PBAC – Automatically enables view permissions when required by higher-level roles.

## 3.2.2 (Released 05/13/2025)

This production patch includes a critical fix to resolve a timeout and crash issue that occurred when users accessed the Data Submission page containing a large number of submission batches.

#### Bug Fixes

- **Resolved Website Crash on Data Submission Page**\
  Optimized backend queries to prevent request timeouts and crashes when accessing submissions with high batch volumes.

## 3.2.1 (Released 04/09/2025)

#### CDS Rebranding

- The CDS Data Commons has been rebranded from **"CDS"** to **"General Commons"** across the user interface and supporting documentation.


#### Bug Fixes

- **CLI Upload Permissions for Collaborators**\
  Resolved an issue where users added as collaborators on a Data Submission were unable to upload files using the CLI uploader tool. Collaborators now have the correct permissions to perform CLI uploads.
- **Incorrect Email Notifications on Submission Release**\
  Fixed an issue where email notifications sent upon data submission release were incorrectly sent to unrelated submitters. Notifications are now properly limited to the original submitter and designated collaborators only.

## 3.2.0 (Released 03/28/2025)

#### Submission Request Enhancements

- Added Submission Request Version Support to ensure backward compatibility.
- Released Submission Request Form 3.0 with added question and UI improvements
- Provided filtering capability on the Submission Requests Page.
- Users can now cancel and restore Submission Requests.
- Added support for conditionally approved studies.
- Study Primary Contacts and PIs will now receive Submission Request email notifications for their study
- New email notifications:
  - When a Submission Request is expiring.
  - When a Submission Request is canceled or restored.
  - For conditionally approved Submission Requests.

#### Data Submission Enhancements

- Studies are now associated with Programs instead of Organizations.
- Submitters can create data submissions only for their assigned studies.
- Submitters can view existing data before overriding a previous submission.
- Data Hub now retrieves caDSR PVs and NCIt synonyms from MDB.
- Metadata validation suggests a permissive value if the entered value matches NCIt synonyms.
- Submitters can view other users' data submissions for their assigned studies.
- Data files are now auto-deleted when a DELETE data submission is completed.
- Validation results now provide an aggregated view for better analysis.
- Added support for Study-level Primary Contact assignments.
- New email notification sent when a Data Submission is deleted.

#### Data Model Navigator Enhancements

- Model Navigator now displays older model versions for reference.
- Model version history is now accessible within the Model Navigator.
- Added additional options for Dictionary Download.

#### Uploader CLI Tool Updates

- Uploader CLI now supports versioning to ensure compatibility.
- Upload progress is now displayed in CLI output for better tracking.
- Local file validation process improved for faster and more accurate uploads.
- Removed redundant CLI parameters for a streamlined experience.

#### User Account & Access Management

- Admins can configure and customize user permissions for system access.
- Admins can configure and customize user accounts to receive email notifications.
- Users must specify the studies they need access to when submitting an access request.
- New email notification sent when user account access is changed.

#### Data Submissions Operation Dashboard

- Added Data Submission metrics by Program.
- Users can now export the Operation Dashboard to PDF for reporting and analysis.

## 3.1.0 (Released 12/20/2024)

- **caDSR Integration**: Submitted metadata is now validated against Common Data Element (CDE) Permissible Values.
- **Operations Dashboard**: Introduced a new dashboard for internal staff to monitor data submissions and operations effectively.
- **CLI Binary Distribution**: The Uploader CLI now supports binary downloads for quicker setup.
- **Automated Data Archiving**: All submitted data in Data Submissions are automatically archived upon completion.
- **CRDC_ID Uniqueness Checks**: Verifies that CRDC_IDs are unique within the Submission Portal, preventing duplication.
- **Manage Study Admin Tool**: Administrators can now view, add, and edit registered studies directly within the Submission Portal.
- **Enhanced Data Upload CLI Tool**: The Uploader CLI now supports AWS bucket-to-bucket data uploads.
- **Data Submission Collaborators**: Submitters can now add collaborators to work on their data submissions.
- **Federal Monitor Role**: Add a new role for federal staff, allowing them to monitor and oversee data submissions within their assigned studies.
- **Data Commons Data Curators**: Data Curators are now associated with specific Data Commons
- **Submission Access Requests**: Authenticated users can now request data submission access for their associated organization.
- **DCF Manifest File Integration**: The metadata release package now includes the DCF manifest file, facilitating automatic transfer to the Data Commons.
- **Submission Request PDF Export**: Users can now export submission requests as PDFs.
- **Data Submissions Table Improvements**: Supports configurable display columns and a compact table view for improved user experience
- **Support for Multiple Data Model Files**: The system now accommodates an arbitrary number of model files for each data model, offering enhanced flexibility.

## 3.0.0 (Released 09/30/2024)

- Support for ICDC and CTDC Data Models and Submissions
- Data View feature to explore content within data submissions
- Cross-validation support for multiple submissions under the same study
- Automatic transfer of curated submissions to Data Commons repositories
- Auto-sync of the latest data model with Data Commons
- Support for DELETE-type submissions to remove previously released data
- Default configuration file for the Uploader CLI tool
- Submitters can submit data using APIs
- Generate CRDC_ID for selected nodes

## 2.1.0 (Released 06/25/2024)

- Support for individual submission templates (one per node type)
- Data Activity view to monitor data upload activities
- Submitters can perform data validations and view results through the web interface
- Visual display of submission nodes, data counts, and validation status
- Release data submission packages to downstream Data Commons repositories
- Enhanced the existing Data Loader to process released data submission packages for downstream Data Commons

## 2.0.0 (Released 02/26/2024)

- Data Model Navigator to review and download submission templates
- Support for CDS Data Models and Submissions
- Data Submission dashboard for submitters to submit study metadata and data files
- End-to-end workflow for data submission (from New to Complete)
- Automated email notifications during each data submission status change
- Data Uploader CLI tool for updating data files and metadata
- Admin tool to manage organizations
- Submitters can download validation results from the standalone Data Loader

## 1.1.0 (Released 11/16/2023)

- Enhanced existing CRDC Data Loader for the down-streamed Data Commons to process the released package from Data Hub using Prefect
- Implement Government Shutdown banner using Adobe Launch

## 1.0.0 (Released 10/23/2023)

- Support for NIH and Login.gov authentication
- Role-based access controls
- Online form for CRDC Submission Requests
- Workflow to review submission requests (from New to Approved/Rejected)
- Admin tools to manage users and their access
- Auto-delete submission requests after 45 days of inactivity
- System-triggered email notifications for approved, rejected, or deleted requests
