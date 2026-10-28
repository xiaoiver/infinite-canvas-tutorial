import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';

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

test('profile real browser SVG import', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
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
  const roundTrips = [];
  for (const name of [
    'vercel.svg',
    'maslow-hierarchy.svg',
    'Ghostscript_Tiger.svg',
  ]) {
    await page.goto('/gizmo.html?extrudePath');
    await expect(page.locator('#status')).toHaveText('Ready');
    const source = await page.evaluate(
      (asset) => fetch(`/${asset}`).then((response) => response.text()),
      name,
    );
    await cdp.send('Profiler.start');
    const result = await page.evaluate(
      (value) => window.gizmoTest.profileSvgArtworkEdit(value),
      source,
    ).catch((error) => { throw new Error(`${name}: ${error}`); });
    const { profile: artworkProfile } = await cdp.send('Profiler.stop');
    expect(result.glbBytes).toBeGreaterThan(0);
    const hotspots = artworkProfile.nodes
      .filter((node) => node.hitCount)
      .sort((a, b) => (b.hitCount ?? 0) - (a.hitCount ?? 0))
      .slice(0, 8)
      .map((node) => ({
        name: node.callFrame.functionName,
        url: node.callFrame.url.split('/').pop(),
        hits: node.hitCount,
      }));
    roundTrips.push({ name, ...result, hotspots });
  }
  const visiblePixels = [];
  for (const zoom of [1, 0.5, 2]) {
    await page.evaluate(async (value) => {
      window.gizmoTest.api().gotoLandmark({ zoom: value }, { duration: 0 });
      await window.gizmoTest.settle();
    }, zoom);
    const png = PNG.sync.read(
      await page.locator('#canvas').screenshot({
        path: testInfo.outputPath(`tiger-zoom-${zoom}.png`),
      }),
    );
    let dark = 0;
    for (let i = 0; i < png.data.length; i += 4)
      if (png.data[i] + png.data[i + 1] + png.data[i + 2] < 450) dark++;
    visiblePixels.push({ zoom, dark });
    expect(dark).toBeGreaterThan(200);
  }
  const artwork = [];
  for (const name of [
    'Ghostscript_Tiger.svg',
    'vercel.svg',
    'maslow-hierarchy.svg',
  ]) {
    const source = await page.evaluate(
      (asset) => fetch(`/${asset}`).then((response) => response.text()),
      name,
    );
    artwork.push({
      name,
      bytes: source.length,
      ...(await page.evaluate(
        (value) => window.gizmoTest.profileSvgImport(value),
        source,
      )),
    });
  }
  console.log(
    JSON.stringify({ result, variants, artwork, roundTrips, visiblePixels, top }),
  );
  expect(result.nodes).toBeGreaterThan(0);
});

test('capture larger SVG extrusion contour views', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.goto('/gizmo.html?extrudePath&width=600&height=400');
  await expect(page.locator('#status')).toHaveText('Ready');
  const source = await page.evaluate(() =>
    fetch('/Ghostscript_Tiger.svg').then((response) => response.text()),
  );
  const artwork = await page.evaluate(
    (svg) => window.gizmoTest.showSvgArtwork(svg, { x: 300, y: 200 }),
    source,
  );
  expect(artwork.extrudedNodes).toBeGreaterThan(0);
  for (const zoom of [1, 2, 3]) {
    await page.evaluate(async (value) => {
      window.gizmoTest.api().gotoLandmark({
        zoom: value,
        x: 300 - 300 / value,
        y: 200 - 200 / value,
      }, { duration: 0 });
      await window.gizmoTest.settle();
    }, zoom);
    await page.locator('#canvas').screenshot({
      path: testInfo.outputPath(`tiger-contours-zoom-${zoom}.png`),
    });
    const reference = await page.evaluate(async ({ svg, zoom: value }) => {
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 400;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        300 - 100 * value,
        200 - 100 * value,
        200 * value,
        200 * value,
      );
      return canvas.toDataURL('image/png').split(',')[1];
    }, { svg: source, zoom });
    writeFileSync(
      testInfo.outputPath(`tiger-svg-reference-zoom-${zoom}.png`),
      Buffer.from(reference, 'base64'),
    );
  }
});
