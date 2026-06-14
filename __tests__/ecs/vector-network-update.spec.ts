import _gl from 'gl';
import '../useSnapshotMatchers';
import {
  App,
  Camera,
  Canvas,
  Children,
  Commands,
  DOMAdapter,
  DefaultPlugins,
  DefaultStateManagement,
  Entity,
  FillLayers,
  StrokeLayers,
  Grid,
  Parent,
  Plugin,
  PreStartUp,
  Renderable,
  Stroke,
  System,
  Theme,
  Transform,
  Visibility,
  system,
  API,
  Name,
  Rect,
  DropShadow,
  ZIndex,
  ComputeZIndex,
  VectorNetwork,
  VectorNetworkSerializedNode,
  Opacity,
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('updateNodeVectorNetwork', () => {
  it('writes back topology and re-normalizes geometry to the local origin', async () => {
    const app = new App();

    let api: API;
    let vnNode: VectorNetworkSerializedNode;

    const MyPlugin: Plugin = () => {
      system(PreStartUp)(StartUpSystem);
      system((s) => s.before(ComputeZIndex))(StartUpSystem);
    };

    class StartUpSystem extends System {
      private readonly commands = new Commands(this);

      q = this.query(
        (q) =>
          q.using(
            Canvas,
            Theme,
            Grid,
            Camera,
            Parent,
            Children,
            Transform,
            Renderable,
            FillLayers,
            StrokeLayers,
            Stroke,
            Rect,
            VectorNetwork,
            Visibility,
            Name,
            DropShadow,
            ZIndex,
            Opacity,
          ).write,
      );

      initialize(): void {
        const $canvas = DOMAdapter.get().createCanvas(
          200,
          200,
        ) as HTMLCanvasElement;

        api = new API(new DefaultStateManagement(), this.commands);

        api.createCanvas({
          element: $canvas,
          width: 200,
          height: 200,
          devicePixelRatio: 1,
        });
        api.createCamera({ zoom: 1 });

        vnNode = {
          type: 'vector-network',
          id: 'vn-1',
          zIndex: 1,
          strokes: [{ type: 'solid', value: 'black', opacity: 1 }],
          strokeWidth: 2,
          fills: [{ type: 'solid', value: 'red', opacity: 1 }],
          vertices: [
            { x: 100, y: 0 },
            { x: 200, y: 100 },
            { x: 300, y: 0 },
          ],
          segments: [
            { start: 0, end: 1 },
            { start: 1, end: 2 },
            { start: 2, end: 0 },
          ],
          regions: [{ fillRule: 'nonzero', loops: [[0, 1, 2]] }],
        };

        api.updateNodes([vnNode]);
      }
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);
    await app.run();
    await sleep(300);

    // After deserialize, the node is normalized: x = minX (100), y = minY (0),
    // and component vertices are local.
    const entity = api.getEntity(vnNode);
    expect(entity.read(Transform).translation.x).toBeCloseTo(100, 3);
    expect(entity.read(Transform).translation.y).toBeCloseTo(0, 3);

    // Move the first vertex 50px to the left in local space.
    const local = entity.read(VectorNetwork);
    const movedVertices = local.vertices.map((v, i) =>
      i === 0 ? { ...v, x: v.x - 50 } : { ...v },
    );

    const currentNode = api.getNodeById('vn-1')!;
    api.updateNodeVectorNetwork(currentNode, {
      vertices: movedVertices,
      segments: local.segments.map((s) => ({ ...s })),
      regions: local.regions?.map((r) => ({ ...r })),
    } as VectorNetwork);

    await sleep(100);

    // The geometry left shifted by -50, so the translation absorbs the offset
    // (100 + (-50) = 50) while the component geometry re-normalizes to origin.
    const after = api.getEntity(vnNode);
    expect(after.read(Transform).translation.x).toBeCloseTo(50, 3);

    const updated = after.read(VectorNetwork);
    const minX = Math.min(...updated.vertices.map((v) => v.x));
    const minY = Math.min(...updated.vertices.map((v) => v.y));
    expect(minX).toBeCloseTo(0, 3);
    expect(minY).toBeCloseTo(0, 3);
    // Topology is preserved.
    expect(updated.segments.map((s) => [s.start, s.end])).toEqual([
      [0, 1],
      [1, 2],
      [2, 0],
    ]);
    expect(updated.regions![0].loops).toEqual([[0, 1, 2]]);

    // The serialized scene node reflects the new vertices for round-tripping.
    const serialized = api.getNodeById('vn-1') as VectorNetworkSerializedNode;
    expect(serialized.vertices.length).toBe(3);
    // Vertex 0 moved left by 50, becoming the new leftmost point, so after
    // normalization it sits at local x === 0.
    expect(serialized.vertices[0].x).toBeCloseTo(0, 3);
    expect(Math.min(...serialized.vertices.map((v) => v.x))).toBeCloseTo(0, 3);

    await app.exit();
  });
});
