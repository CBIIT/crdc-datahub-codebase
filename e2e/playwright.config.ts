import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env', quiet: true });

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      retries: 3,
    },
    {
      name: 'Chrome (Desktop)',
      use: {
        ...devices['Desktop Chrome'],
        storageState: process.env.AUTH_STATE_PATH,
      },
      dependencies: ['setup'],
      testIgnore: /.*\.setup\.ts/
    },
  ]
});
