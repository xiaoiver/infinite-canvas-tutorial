import { createApp } from 'vue';
import IsometricView from '../../../packages/site/docs/components/IsometricView.vue';
import {
  Camera3D,
  Extrude3D,
  Mesh3DNode,
  Transform3D,
  type API,
} from '../../../packages/ecs/src';
import {
  createGizmoFrame,
  projectGizmoPoint,
} from '../../../packages/ecs/src/utils/gizmo-frame';
import {
  buildPickSceneForViewport,
  probePick3DAtViewport,
} from '../../../packages/ecs/src/utils/pick3d-probe';
import { settleECSFrames } from './ecs-frames';

let api: API | undefined;
let lastAnchorPointer: { pointerType: string; trusted: boolean } | undefined;
const anchorEvents: string[] = [];
for (const phase of [
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
])
  document.addEventListener(
    phase,
    (event) => {
      if (
        (event.target as Element).matches?.(
          'svg.isometric-preview, circle.path-anchor',
        )
      )
        anchorEvents.push(`${phase}:${(event as PointerEvent).pointerType}`);
    },
    true,
  );
document.addEventListener(
  'pointerdown',
  (event) => {
    if ((event.target as Element).matches?.('circle.path-anchor'))
      lastAnchorPointer = {
        pointerType: event.pointerType,
        trusted: event.isTrusted,
      };
  },
  true,
);
const app = createApp(IsometricView, { locale: 'zh' });
app.mount('#demo');
document.querySelector('ic-spectrum-canvas')!.addEventListener(
  'ic-ready',
  (event) => {
    api = (event as CustomEvent<API>).detail;
  },
  { once: true },
);

const probe = {
  ready: () => {
    if (!api?.getNodeById('iso-ring')) return false;
    const layers = new Set(api.getMesh3DLayers().map((layer) => layer.id));
    return layers.has('iso-cube') && layers.has('iso-ring');
  },
  settle: () => settleECSFrames(api!, 3),
  selectGroup: async () => {
    await api!.edit(
      (editor) => editor.selectMesh3DLayers(['iso-cube', 'iso-ring']),
      { capture: 'NEVER' },
    );
    await settleECSFrames(api!, 3);
    return api!.getSelectedMesh3DLayerIds();
  },
  groupPositions: () => ({
    cube: api!.getNodeById('iso-cube').x,
    ring: api!.getNodeById('iso-ring').x,
  }),
  moveCube: async (deltaX: number) => {
    const cube = api!.getNodeById('iso-cube');
    api!.updateNode(cube, { x: cube.x + deltaX });
    await settleECSFrames(api!, 3);
  },
  groupXHandle: () => {
    const editor = api!;
    const cube = editor
      .getEntity(editor.getNodeById('iso-cube'))
      .read(Mesh3DNode).meshEntity!;
    const ring = editor
      .getEntity(editor.getNodeById('iso-ring'))
      .read(Extrude3D).meshEntity!;
    const selected = [cube, ring];
    const center = selected.reduce<[number, number, number]>(
      (sum, entity) => {
        const point = entity.read(Transform3D).translation;
        return [
          sum[0] + point[0] / 2,
          sum[1] + point[1] / 2,
          sum[2] + point[2] / 2,
        ];
      },
      [0, 0, 0],
    );
    const rect = editor.getCanvasElement().getBoundingClientRect();
    const camera = editor.getCanvas().read(Camera3D);
    const scene = buildPickSceneForViewport(
      camera,
      rect.width,
      rect.height,
      rect.width,
      rect.height,
    )!;
    const frame = createGizmoFrame(scene, center, rect.width, rect.height)!;
    const origin = projectGizmoPoint(frame, center)!;
    for (const fraction of [0.55, 0.65, 0.75, 0.85]) {
      const point = projectGizmoPoint(frame, [
        center[0] + frame.scale * fraction,
        center[1],
        center[2],
      ]);
      if (!point) continue;
      const hit = probePick3DAtViewport(
        point[0],
        point[1],
        rect.width,
        rect.height,
        camera,
        scene,
        selected,
        selected,
      );
      if (
        hit.kind !== 'gizmo' ||
        hit.axis !== 'x' ||
        hit.partKind !== 'translate'
      )
        continue;
      const length = Math.hypot(point[0] - origin[0], point[1] - origin[1]);
      return {
        point: { x: rect.left + point[0], y: rect.top + point[1] },
        delta: [
          (24 * (point[0] - origin[0])) / length,
          (24 * (point[1] - origin[1])) / length,
        ] as [number, number],
      };
    }
    throw new Error('Could not find the shared X gizmo handle');
  },
  path: () => {
    const node = api!.getNodeById('iso-ring');
    return node?.type === 'path' ? node.d : undefined;
  },
  lastAnchorPointer: () => lastAnchorPointer,
  anchorEvents: () => [...anchorEvents],
  undo: async () => {
    api!.undo();
    await settleECSFrames(api!, 3);
  },
  unmount: () => app.unmount(),
};
declare global {
  interface Window {
    isometricDocs: typeof probe;
  }
}
window.isometricDocs = probe;
