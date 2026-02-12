# Overview

This repository contains the source code for a project called the CRDC Submission Portal (CRDC-DH / Data Hub). This portal facilitates the submission of metadata and data files collected through cancer research studies and allows users to submit their data to a designated data repository.

## Core Features

1. Submission Requests: A form-based interface that allows new users to onboard to the portal by providing comprehensive details about their research studies and the data they plan to submit. This is a prerequisite step before any data submission can occur.
2. Model Navigator: A tool that allows end users to explore model definition framework (MDF) data models belonging to the different data repositories supported by the portal. This feature helps users understand the structure and requirements of the data they need to submit.
3. Data Submission: Once users have completed the submission request, they can upload their metadata and data files to a Data Submission. This process includes detailed validation checks to ensure that the submitted files meet the preset standards defined by the portal and designated data repository. 
4. Data Explorer: Once a study has gone through the Data Submission process, users can explore the submitted data through a Data Explorer interface. This feature provides a user-friendly way to view and analyze the submitted metadata.

## Additional Features

- User management and authorization using a permission-based access control system.
- Study management tools for creating and editing studies.
- Program management tools for creating and editing programs, as well as assigning studies to specific programs.
- Open APIs for programmatic access to many of the portal's functionalities, specifically relating to data submission.

## Technical Details

This repository holds the frontend (UX) code for the project, and is built using the following core technologies:

- React.js
- TypeScript
- Material UI (v5)
- Vite with Vitest
- ESLint and Prettier

# Guidance for Copilot & Coding Agent

### 1. Stay Consistent with Project Structure and Standards
   - Follow the established folder structure and naming conventions.
   - Use TypeScript following existing typing conventions.
   - Adhere to ESLint and Prettier rules; run linting and formatting before submitting changes.
   - Reuse existing components, hooks, and utilities where applicable; avoid duplicating functionality.

### 2. User Experience (If applicable)
   - Maintain consistency with the portal’s UI/UX by using Material UI components and themes.
   - Prioritize accessibility (ARIA labels, keyboard navigation, etc.).
   - Ensure that any error messages are clear and user-friendly.

### 3. Testing
   - Write or update unit and integration tests for all new changes
   - Mock API interactions as needed; do not rely on external services in tests.
   - Ensure new and existing tests pass before submitting changes.

### 4. API Integration
   - Use provided API utility modules for all network interactions.
   - Validate and handle API responses and errors gracefully.

### 5. Security and Permissions
   - Respect the permission-based access model; do not expose or bypass authorization checks in UI logic.
   - Do not leak sensitive information in logs or error messages.

### 6. Documentation
   - Update or add relevant documentation and code comments, especially for complex logic or new features.
   - Use clear commit messages and meaningful pull request descriptions.
   - If given a relevant Jira ticket, ensure that ticket number is included in the commit message and pull request description.
   - If applicable to the code change, include any relevant storybook screenshots in the pull request description. Ensure the screenshot uses storybook in fullscreen mode.
