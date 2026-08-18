import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env', quiet: true });

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    [
      './reporters/release-report/index.ts',
      {
        product: 'CRDC Submission Portal',
        outputDir: 'qa-release-report',
        areaMap: {
          'auth/': 'Authentication',
          'data-submissions/': 'Data Submissions',
          'model-navigator/': 'Model Navigator',
          'submission-requests/': 'Submission Requests',
        },
      },
    ],
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      retries: 2,
    },
    {
      name: 'Chrome (Desktop)',
      use: {
        ...devices['Desktop Chrome'],
        storageState: process.env.AUTH_STATE_PATH,
      },
      grepInvert: /@unauthenticated/,
      dependencies: ['setup'],
      testIgnore: /.*\.setup\.ts/
    },
    {
      name: "Chrome (Desktop)",
      use: {
        ...devices['Desktop Chrome'],
      },
      grep: /@unauthenticated/,
      testIgnore: /.*\.setup\.ts/
    },
  ]
});
