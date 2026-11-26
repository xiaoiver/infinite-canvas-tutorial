import { sumCameraPhases } from '../../scripts/camera-phase-tools.mjs';
import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { installProbes } from './fixtures/probes';
import { sameReplayView, replayStrokeNodes } from './fixtures/camera-replay';
import type {} from './fixtures/core-path-instances';
import type { PolylineLODHarness } from './fixtures/polyline-lod';
declare global {
  interface Window {
    polylineLOD: PolylineLODHarness;
  }
}
for (const [backend, mode] of [
  ['core', 'fixed'],
  ['ecs', 'fixed'],
  ['core', 'transient'],
  ['ecs', 'transient'],
  ['core', 'phases'],
  ['ecs', 'phases'],
] as const)
  test(`${backend} ${mode} replay labels completed camera frames and preserves document/ownership`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(installProbes, { resourceStacks: false });
    await page.goto(
      (backend === 'core'
        ? '/core-path-instances.html'
        : '/polyline-lod.html') + (mode === 'phases' ? '?cameraPhases=1' : ''),
    );
    await expect(page.locator('#status')).toHaveText('Ready');
    await page.evaluate(
      async ({ backend, nodes }) => {
        if (backend === 'core') {
          window.corePathInstances.strokes(nodes.length);
          window.corePathInstances.enable(true);
        } else {
          await window.polylineLOD.document(nodes);
          await window.polylineLOD.pathInstancing(true);
        }
      },
      { backend, nodes: replayStrokeNodes(24) },
    );
    const document = await page.evaluate(
      (b) =>
        b === 'core'
          ? window.corePathInstances.replayDocument()
          : window.polylineLOD.replayDocument(),
      backend,
    );
    if (mode !== 'fixed')
      await page.evaluate(async (b) => {
        const view = { x: 0, y: 0, zoom: 0.13 };
        if (b === 'core') window.corePathInstances.replayCamera(view);
        else await window.polylineLOD.navigateCamera(view);
      }, backend);
    const raster =
      mode !== 'fixed'
        ? await page.evaluate(
            (b) =>
              b === 'core'
                ? window.corePathInstances.export(false)
                : window.polylineLOD.export(false),
            backend,
          )
        : undefined;
    const steps = [
      { x: 0, y: 0, zoom: 0.13 },
      { x: 0, y: 0, zoom: 0.13 },
      { x: 100000, y: 100000, zoom: 0.26 },
      { x: 0, y: 0, zoom: 0.52 },
      { x: 0, y: 0, zoom: 0.13 },
    ];
    for (const [i, view] of steps.entries()) {
      const row = await page.evaluate(
        async ({ backend, view, mode }) =>
          backend === 'core'
            ? window.corePathInstances.replayCamera(view)
            : mode === 'transient'
            ? await window.polylineLOD.navigateCamera(view)
            : await window.polylineLOD.replayCamera(view),
        { backend, view, mode },
      );
      if (mode === 'transient') expect(row.frames).toHaveLength(1);
      expect(sameReplayView(row.frames.at(-1)!.view, view)).toBe(true);
      expect(
        row.frames.every((f) => f.elapsed >= 0 && Number.isFinite(f.elapsed)),
      ).toBe(true);
      expect(row.operationToResultMs).toBeGreaterThanOrEqual(
        row.operationToFrameMs,
      );
      if (mode === 'phases') {
        const summary = sumCameraPhases(row.frames);
        expect(summary.frames).toBe(row.frames.length);
        for (const frame of row.frames) {
          expect(frame.data.phaseDetail).toBe('camera');
          expect(frame.data.phases['native.draw']?.calls ?? 0).toBe(
            frame.data.native.drawcalls,
          );
          if (i === 1) {
            expect(
              Object.keys(frame.data.phases).filter((name) =>
                /^(material\.|channel\.|batch\.(resolve|key|collect|validate|append|instances|glyphs))/.test(
                  name,
                ),
              ),
            ).toEqual([]);
          }
          if (i === 3) {
            expect(frame.data.phases['material.path']?.calls).toBeGreaterThan(
              0,
            );
            expect(frame.data.phases['material.stroke']?.calls).toBeGreaterThan(
              0,
            );
            if (backend === 'ecs') {
              expect(frame.data.phases['batch.resolve']?.calls).toBeGreaterThan(
                0,
              );
              expect(frame.data.phases['batch.key']?.calls).toBeGreaterThan(0);
            }
          }
        }
      }
      for (const frame of row.frames) {
        expect(frame.startedAt + frame.elapsed).toBeCloseTo(
          frame.completedAt,
          3,
        );
        expect(frame.observedAt - frame.completedAt).toBeCloseTo(
          frame.observationMs,
          3,
        );
        expect(frame.observationMs).toBeGreaterThanOrEqual(0);
      }
      expect(row.frames.at(-1)!.data.visible).toBe(i === 2 ? 0 : 24);
      expect(row.frames.at(-1)!.data.visibleIndices).toEqual(
        i === 2 ? [] : Array.from({ length: 24 }, (_, i) => i),
      );
      if (i === 1) expect(row.frames.at(-1)!.data.native.drawcalls).toBe(0);
    }
    if (mode !== 'fixed')
      expect(
        await page.evaluate(
          (b) =>
            b === 'core'
              ? window.corePathInstances.export(false)
              : window.polylineLOD.export(false),
          backend,
        ),
      ).toBe(raster);
    expect(
      await page.evaluate(
        (b) =>
          b === 'core'
            ? window.corePathInstances.replayDocument()
            : window.polylineLOD.replayDocument(),
        backend,
      ),
    ).toEqual(document);
    const baseline = await page.evaluate(
      async (b) =>
        b === 'core'
          ? window.corePathInstances.destroy()
          : await window.polylineLOD.destroy(),
      backend,
    );
    if (backend === 'core')
      expect(
        await page.evaluate(() => window.lifecycleProbes.resources()),
      ).toEqual(baseline);
    else
      expect(await page.evaluate(() => window.lifecycleProbes.leaks())).toEqual(
        [],
      );
    expect(errors).toEqual([]);
  });
