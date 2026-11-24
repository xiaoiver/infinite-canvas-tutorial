import { test as base } from '@playwright/test';

// A shared Linux Chromium process can spend most of a 90-second gesture test
// creating its next context. Give these cases a fresh owned process without
// creating the default shared context first. Playwright's context defaults and
// artifact hooks apply to contexts created through this public connection too.
export const test = base.extend({
  context: async (
    { browserName, playwright, launchOptions, headless, channel },
    use,
  ) => {
    if (browserName !== 'chromium')
      throw new Error('This fixture requires Chromium');
    const options = { ...launchOptions, host: '127.0.0.1' };
    if (headless !== undefined) options.headless = headless;
    if (channel !== undefined) options.channel = channel;
    const server = await playwright.chromium.launchServer(options);
    try {
      const browser = await playwright.chromium.connect(server.wsEndpoint());
      try {
        const context = await browser.newContext();
        try {
          await use(context);
        } finally {
          // Finish traces/screenshots before disconnecting and reaping the process.
          await context.close();
        }
      } finally {
        await browser.close();
      }
    } finally {
      await server.kill();
    }
  },
});
