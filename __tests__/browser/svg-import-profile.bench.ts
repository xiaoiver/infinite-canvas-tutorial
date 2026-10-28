import { test, expect } from '@playwright/test';

function sample(instances: number, segments: number) {
  const points = Array.from({ length: segments }, (_, index) => {
    const angle = (index * Math.PI * 2) / segments;
    const radius = 100 + 12 * Math.sin(angle * 19);
    return `${(radius * Math.cos(angle) + 120).toFixed(3)} ${(
      radius * Math.sin(angle) +
      120
    ).toFixed(3)}`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="5200" height="240"><defs><path id="motif" d="M${points.join(
    ' L',
  )} Z" fill="#3366dd"/></defs>${Array.from(
    { length: instances },
    (_, index) => `<use href="#motif" x="${index * 260}"/>`,
  ).join('')}</svg>`;
}

test('profile real browser SVG import', async ({ page }) => {
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const source = sample(20, 1000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  const result = await page.evaluate(
    (svg) => window.gizmoTest.profileSvgImport(svg),
    source,
  );
  const { profile } = await cdp.send('Profiler.stop');
  const top = profile.nodes
    .filter((node) => node.hitCount)
    .sort((a, b) => (b.hitCount ?? 0) - (a.hitCount ?? 0))
    .slice(0, 25)
    .map((node) => ({
      name: node.callFrame.functionName,
      url: node.callFrame.url.split('/').pop(),
      hits: node.hitCount,
    }));
  const variants = [];
  for (const [instances, segments] of [
    [1, 1000],
    [20, 100],
    [20, 1000],
  ]) {
    const svg = sample(instances, segments);
    variants.push({
      instances,
      segments,
      ...(await page.evaluate(
        (value) => window.gizmoTest.profileSvgImport(value),
        svg,
      )),
    });
  }
  console.log(JSON.stringify({ result, variants, top }));
  expect(result.nodes).toBeGreaterThan(0);
});
