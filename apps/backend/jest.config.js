/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    // Resolve packages (e.g. uuid) from apps/backend/node_modules when required from lib/db-driver
    modulePaths: ['<rootDir>/node_modules'],
};
