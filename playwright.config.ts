import { defineConfig, devices } from '@playwright/test';

// Browser tests: the built package in a plain page (fixture) and the demo site.
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { trace: 'off' },
  webServer: [
    {
      command: 'npx vite --config tests/browser/vite.config.ts --host 127.0.0.1',
      url: 'http://127.0.0.1:4175/tests/browser/fixture.html',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx vite preview --config demo/vite.config.ts --host 127.0.0.1 --port 4174 --strictPort',
      url: 'http://127.0.0.1:4174/',
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
