import type { CDPSession } from '@playwright/test';
import { test as base } from '../../isolated-webkit-test';

// Preserve WebKit's per-test browser isolation. Record a bounded event trail
// because Chromium can report a destroyed execution context without navigation.
export const test = base.extend({
  page: async ({ page, browserName }, use, testInfo) => {
    const started = Date.now();
    const events: { elapsed: number; type: string; detail: unknown }[] = [];
    const record = (type: string, detail: unknown = null) => {
      events.push({ elapsed: Date.now() - started, type, detail });
      if (events.length > 50) events.shift();
    };
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame())
        record('navigation', frame.url().slice(0, 1000));
    });
    page.on('close', () => record('close'));
    page.on('crash', () => record('crash'));
    page.on('pageerror', (error) =>
      record('page-error', error.message.slice(0, 1000)),
    );
    page.on('console', (message) => {
      if (message.text().startsWith('[vite]'))
        record('vite', message.text().slice(0, 1000));
    });
    page.on('requestfailed', (request) =>
      record('request-failed', {
        url: request.url().slice(0, 1000),
        error: request.failure()?.errorText,
      }),
    );
    let session: CDPSession | undefined;
    if (browserName === 'chromium') {
      try {
        session = await page.context().newCDPSession(page);
        session.on('Runtime.executionContextDestroyed', (event) =>
          record('context-destroyed', event),
        );
        session.on('Runtime.executionContextsCleared', () =>
          record('contexts-cleared'),
        );
        await session.send('Runtime.enable');
      } catch (error) {
        record('diagnostic-unavailable', String(error).slice(0, 1000));
      }
    }
    try {
      await use(page);
    } finally {
      if (testInfo.status !== testInfo.expectedStatus) {
        // Use only host-side state: page.evaluate() can fail or hang precisely
        // when this attachment is needed. Keep the original test failure.
        await testInfo.attach('browser-lifecycle', {
          body: JSON.stringify(
            {
              browser: browserName,
              url: page.url().slice(0, 1000),
              closed: page.isClosed(),
              connected: page.context().browser()?.isConnected(),
              events,
            },
            null,
            2,
          ),
          contentType: 'application/json',
        });
      }
      await session?.detach().catch(() => {});
    }
  },
});
