import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    // Show mouse cursor and highlight elements during test execution
    await page.screencast.showActions({ cursor: 'pointer' });
    
    await use(page);
  }
});

export { expect } from '@playwright/test';
