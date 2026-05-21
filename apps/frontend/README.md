# Introduction

The CRDC Submission Portal is a React application that facilitates the data submission process for participating CRDC Data Commons projects. This project utilizes React.js, TypeScript, MUI, and Apollo Client, among other dependencies.

[![Coverage Status](https://coveralls.io/repos/github/CBIIT/crdc-datahub-codebase/badge.svg?branch=master)](https://coveralls.io/github/CBIIT/crdc-datahub-codebase?branch=master)
[![Test](https://github.com/CBIIT/crdc-datahub-codebase/actions/workflows/test.yml/badge.svg)](https://github.com/CBIIT/crdc-datahub-codebase/actions/workflows/test.yml)
[![TypeScript](https://github.com/CBIIT/crdc-datahub-codebase/actions/workflows/typescript.yml/badge.svg)](https://github.com/CBIIT/crdc-datahub-codebase/actions/workflows/typescript.yml)
[![ESLint](https://github.com/CBIIT/crdc-datahub-codebase/actions/workflows/lint.yml/badge.svg)](https://github.com/CBIIT/crdc-datahub-codebase/actions/workflows/lint.yml)
[![RelativeCI](https://badges.relative-ci.com/badges/CivyupUfCpfv73Jawheu?branch=master&style=flat)](https://app.relative-ci.com/projects/CivyupUfCpfv73Jawheu)

## Installation

To run the CRDC Submission Portal project locally, follow these steps:

1. Clone the repository
2. Navigate to the project directory
3. Copy `.env.example` to `.env` and update the environment variables as needed
4. Install the dependencies: `npm ci`
5. Start the development server: `npm start`
6. Open your browser and visit `http://localhost:3010` to access the application.

For instructions on configuring the project, or for developer technical documentation, see the [docs](./docs/index.md) folder.

## Contributing

We welcome any form of contributions to the CRDC Submission Portal project.

We use Husky to run a pre-commit hook that will run ESLint, Prettier, and Typechecking on staged files. If there are any issues, you will need to fix them before you can commit your changes.

If you need to bypass the pre-commit hook, you can use the Git `--no-verify` flag when committing your changes. However, this is not recommended as our CI/CD pipeline will fail if there are any issues.
