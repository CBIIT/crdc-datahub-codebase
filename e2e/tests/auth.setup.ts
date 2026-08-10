import { test, expect } from '@playwright/test';
import * as OTPAuth from "otpauth";
import dotenv from 'dotenv';

dotenv.config({ path: '.env', quiet: true });

const generateOTP = (secret: string) => {
  const totp = new OTPAuth.TOTP({
    secret: secret,
    digits: 6,
    algorithm: "sha1",
    period: 30,
  });

  return totp.generate();
};

test('authenticate and persist session', async ({ page }) => {
  await page.goto('https://hub-dev.datacommons.cancer.gov/');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('link', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'Login.gov' }).click();
  await page.waitForTimeout(1500);

  await page.getByRole('textbox', { name: 'Email address' }).fill(process.env.LOGIN_GOV_EMAIL || "");
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.LOGIN_GOV_PASSWORD || "");
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.waitForTimeout(1500);

  await page.getByText('Authentication app Use your').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('textbox', { name: 'One-time code' }).fill(generateOTP(process.env.LOGIN_GOV_OTP_SECRET || ""));
  await page.getByRole('button', { name: 'Submit' }).click();

  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Grant' }).click();

  await expect(page).toHaveURL(/hub-dev\.datacommons\.cancer\.gov/);

  await page.waitForTimeout(1500);
  await page.context().storageState({ path: process.env.AUTH_STATE_PATH });
});
