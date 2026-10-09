import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './__tests__/react/browser',
  testMatch: '*.spec.ts',
  outputDir: '.test-results/react',
  timeout: 60000,
  // Shard individual cases instead of whole files. Each runner still executes
  // sequentially; these tests own their page and have no shared beforeAll state.
  fullyParallel: true,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4177',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    },
  },
  webServer: {
    command: 'npm run dev:react-tests',
    url: 'http://127.0.0.1:4177',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
