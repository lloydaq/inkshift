import { expect, test } from '@playwright/test';

const DEMO = 'http://127.0.0.1:4174/';

test.describe('demo site (React integration)', () => {
  test('loads in the system theme without errors, then toggles and persists', async ({ page }) => {
    const errs: string[] = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(DEMO, { waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: 'Switch to dark theme' }).first().click();
    await expect(page.locator('html')).not.toHaveClass(/inkshift-transition/, { timeout: 5000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(errs).toEqual([]);
  });

  test('the preference control switches to system and clears storage', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.goto(DEMO);
    await page.getByRole('radio', { name: 'Light', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate(() => localStorage.getItem('inkshift-demo-theme'))).toBe('light');
    await page.getByRole('radio', { name: 'System', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('inkshift-demo-theme'))).toBeNull();
  });

  test('the reversal demo presses back and logs a restored theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
    await page.goto(DEMO, { waitUntil: 'networkidle' });
    const vt = await page.evaluate(() => typeof document.startViewTransition === 'function');
    test.skip(!vt, 'No View Transitions in this browser');
    await page.getByRole('button', { name: 'Spill, then press back' }).click();
    await expect(page.getByText(/Last reversal: dark to light was pressed back and the page stayed dark/)).toBeVisible({ timeout: 5000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('follows a system theme change live', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(DEMO);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
