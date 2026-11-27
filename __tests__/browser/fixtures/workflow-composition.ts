import type { Page } from '@playwright/test';
export type CompositionCondition =
  | 'normal'
  | 'flat-overlay'
  | 'transparent-canvas'
  | 'flat-transparent';
function snapshot() {
  const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
  const overlay = document.querySelector<HTMLElement>('.performance')!;
  const box = canvas.getBoundingClientRect();
  const a = getComputedStyle(canvas),
    b = getComputedStyle(overlay);
  return {
    styleTags: document.querySelectorAll('#workflow-composition-style').length,
    hitTarget: document.elementFromPoint(
      box.x + box.width / 2,
      box.y + box.height / 2,
    )?.id,
    surface: {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      bufferWidth: canvas.width,
      bufferHeight: canvas.height,
    },
    canvas: {
      opacity: a.opacity,
      visibility: a.visibility,
      display: a.display,
      pointerEvents: a.pointerEvents,
      transform: a.transform,
      inlineStyle: canvas.getAttribute('style'),
    },
    overlay: {
      backdropFilter: b.backdropFilter,
      opacity: b.opacity,
      visibility: b.visibility,
      display: b.display,
      inlineStyle: overlay.getAttribute('style'),
    },
  };
}
/** Host-side CSS changes only; the existing renderer, input and frame observers stay active. */
export async function installWorkflowComposition(
  page: Page,
  condition: CompositionCondition,
) {
  const before = await page.evaluate(snapshot);
  if (before.styleTags)
    throw new Error('Composition stylesheet already installed');
  const style = await page.addStyleTag({
    content:
      '/* Workflow composition control; no default style changes. */\n' +
      (condition.includes('flat')
        ? '.performance { backdrop-filter: none !important; }\n'
        : '') +
      (condition.includes('transparent')
        ? '#canvas { opacity: 0 !important; }'
        : ''),
  });
  try {
    await style.evaluate((el) => {
      (el as HTMLStyleElement).id = 'workflow-composition-style';
    });
    const during = await page.evaluate(snapshot);
    const graphics = await page.evaluate(() => {
      const gl = document
        .querySelector<HTMLCanvasElement>('#canvas')!
        .getContext('webgl2')!;
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer: String(gl.getParameter(gl.RENDERER)),
        unmaskedRenderer: debug
          ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
          : undefined,
        version: String(gl.getParameter(gl.VERSION)),
        shadingLanguageVersion: String(
          gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        ),
        attributes: gl.getContextAttributes(),
      };
    });
    let restored = false;
    return {
      metadata: {
        condition,
        scope: 'css-only',
        before,
        during,
        graphics,
        after: undefined as ReturnType<typeof snapshot> | undefined,
        restored: false,
      },
      read: () => page.evaluate(snapshot),
      async restore() {
        if (!restored) {
          await style.evaluate((el) => (el as HTMLStyleElement).remove());
          await style.dispose();
          restored = true;
        }
        return page.evaluate(snapshot);
      },
    };
  } catch (error) {
    await style
      .evaluate((el) => (el as HTMLStyleElement).remove())
      .catch(() => {});
    await style.dispose();
    throw error;
  }
}
