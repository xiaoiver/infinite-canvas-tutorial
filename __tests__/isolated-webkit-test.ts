import { test as base } from '@playwright/test';

// Long sequences of canvas pages stall during initialization/teardown when CI
// reuses one Linux WebKit process. Give each WebKit case its own browser process
// while preserving the normal Chromium fixture. Playwright applies the configured
// device/context defaults and records traces for the contexts created here.
export const test = base.extend({
  context: async ({ context, browserName, playwright }, use) => {
    if (browserName !== 'webkit') {
      await use(context);
      return;
    }
    // Own the process separately from the client connection. On Linux CI,
    // browser.close() can spend 30 seconds waiting for WebKit to exit even after
    // its contexts have closed. Finish context cleanup (including artifacts)
    // normally, then reap this test's disposable process through the public API.
    const server = await playwright.webkit.launchServer({ host: '127.0.0.1' });
    try {
      const browser = await playwright.webkit.connect(server.wsEndpoint());
      try {
        const isolated = await browser.newContext();
        try {
          await use(isolated);
        } finally {
          await isolated.close();
        }
      } finally {
        // For a connected browser this releases the client, not the process.
        await browser.close();
      }
    } finally {
      await server.kill();
    }
  },
});
