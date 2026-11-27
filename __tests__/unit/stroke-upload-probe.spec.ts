import { createStrokeResidencyModel } from '../browser/fixtures/stroke-residency-model';
import { createStrokeUploadProbe } from '../browser/fixtures/stroke-upload-probe';
import { packStrokeInstances } from '../../packages/core/src/utils/stroke-batching';

for (const backend of ['core', 'ecs'] as const)
  describe(backend + ' emitted stroke upload recorder', () => {
    let oldWindow: any;
    beforeEach(() => {
      oldWindow = globalThis.window;
      globalThis.window = {} as any;
      (window as any).createStrokeResidencyModel = createStrokeResidencyModel;
      createStrokeUploadProbe();
    });
    afterEach(() => {
      (window as any).strokeUploadProbe?.dispose();
      globalThis.window = oldWindow;
    });
    const node = () => ({
      hold() {
        return this;
      },
      uid: 1,
      ordinal: 1,
      points: [0, 0, 0, 1, 1, 0, 2, 2, 0, 3, 3, 0],
      travel: [0, 1, 2],
      placement: [0, 0, 0],
    });
    function setup() {
      const stride = backend === 'core' ? 1 : 3;
      class Base {
        device: any;
        nodes: ReturnType<typeof node>[] = [];
        constructor(device: any = {}) {
          this.device = device;
        }
        getStrokeBuffers(n: ReturnType<typeof node>) {
          return { pointsBuffer: n.points, travelBuffer: n.travel };
        }
        createGeometry() {
          const parts = this.nodes.map((n) => {
            const b = this.getStrokeBuffers(n);
            return {
              points: b.pointsBuffer,
              travel: b.travelBuffer,
              translationAndOrder: n.placement as [number, number, number],
            };
          });
          const p = packStrokeInstances(parts, stride);
          (window as any).strokeUploadProbe.packed(
            parts,
            stride,
            p.points,
            p.travel,
          );
        }
        destroy() {}
      }
      class Batch extends Base {}
      const probe = (window as any).strokeUploadProbe;
      probe.packedModuleLoaded();
      probe.install(Batch, backend);
      const draw = new Batch(),
        n = node();
      draw.nodes = [n];
      const frame = () => {
        probe.begin();
        draw.createGeometry();
        return probe.take();
      };
      return { draw, n, frame, probe, Batch, Base, stride };
    }
    it('primes before measurement and distinguishes placement from identical emitted geometry', () => {
      const { draw, n, frame, stride } = setup();
      draw.createGeometry();
      const same = frame();
      expect(same.unchangedGeometryNodes).toBe(1);
      expect(same.firstNodes).toBe(0);
      expect(same.resident4m_hits).toBe(1);
      expect(same.resident4m_geometryBytes).toBe(0);
      expect(same.spanUploadBytes).toBe(0);
      n.placement[0] = 10;
      const moved = frame();
      expect(moved.unchangedGeometryNodes).toBe(1);
      expect(moved.placementChanges).toBe(1);
      expect(moved.resident4m_hits).toBe(1);
      expect(moved.resident4m_placementBytes).toBe(16);
      expect(moved.unchangedPayloadBytes).toBe(0);
      expect(moved.unchangedGeometryBytes).toBe((12 + stride) * 4);
      expect(moved.spanUploadBytes).toBe(4);
    });
    it('compares values after Float32 conversion, observing in-place edits and signed zero', () => {
      const { draw, n, frame } = setup();
      draw.createGeometry();
      n.points[3] = 1 + 1e-9;
      expect(frame().unchangedGeometryNodes).toBe(1);
      n.points[3] = 2;
      const changed = frame();
      expect(changed.changedGeometryNodes).toBe(1);
      expect(changed.resident4m_misses).toBe(1);
      n.points[0] = -0;
      expect(frame().changedGeometryNodes).toBe(1);
    });
    it('tracks node geometry across pages but separates device identities', () => {
      const { draw, n, probe, Batch } = setup();
      draw.createGeometry();
      const next = new Batch(draw.device);
      next.nodes = [n];
      probe.begin();
      next.createGeometry();
      expect(probe.take().unchangedGeometryNodes).toBe(1);
      const other = new Batch();
      other.nodes = [n];
      probe.begin();
      other.createGeometry();
      expect(probe.take().firstNodes).toBe(1);
    });
    if (backend === 'ecs')
      it('separates overlapping ordinals and rebound borrowed handles', () => {
        const { draw, probe } = setup();
        const a = node(),
          b = node();
        draw.nodes = [a, b];
        probe.begin();
        draw.createGeometry();
        expect(probe.take().firstNodes).toBe(2);
        let owner: object = {};
        const borrowed = { ...node(), hold: () => owner };
        draw.nodes = [borrowed];
        draw.createGeometry();
        owner = {};
        probe.begin();
        draw.createGeometry();
        expect(probe.take().firstNodes).toBe(1);
      });
    it('clears page history on retirement and restores inherited methods', () => {
      const { draw, frame, probe, Batch, Base } = setup();
      draw.createGeometry();
      draw.destroy();
      expect(frame().spanUploadBytes).toBeGreaterThan(0);
      expect(Object.hasOwn(Batch.prototype, 'createGeometry')).toBe(true);
      expect(probe.dispose()).toBe(true);
      expect(Object.hasOwn(Batch.prototype, 'createGeometry')).toBe(false);
      expect(Batch.prototype.createGeometry).toBe(
        Base.prototype.createGeometry,
      );
      expect((window as any).strokeUploadProbe).toBeUndefined();
      expect((window as any).createStrokeResidencyModel).toBeUndefined();
    });
    it('unwinds failures without leaving an active stack and rejects duplicate installation', () => {
      const { draw, probe, Batch } = setup();
      expect(() => probe.install(Batch, backend)).toThrow('already installed');
      draw.nodes = [{ ...node(), uid: NaN, ordinal: NaN }];
      probe.begin();
      expect(() => draw.createGeometry()).toThrow('Invalid stroke owner');
      expect(() => probe.take()).not.toThrow();
      expect(probe.dispose()).toBe(true);
    });
  });
