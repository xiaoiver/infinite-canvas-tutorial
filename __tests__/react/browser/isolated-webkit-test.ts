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
    const browser = await playwright.webkit.launch();
    try {
      const isolated = await browser.newContext();
      try {
        await use(isolated);
      } finally {
        await isolated.close();
      }
    } finally {
      await browser.close();
    }
  },
});
