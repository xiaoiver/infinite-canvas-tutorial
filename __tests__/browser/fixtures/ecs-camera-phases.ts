import {
  ComputeCamera,
  ComputeBounds,
  ViewportCulling,
  ComputeZIndex,
  Sort,
  MeshPipeline,
} from '@infinite-canvas-tutorial/ecs';
import { BatchManager } from '../../../packages/ecs/src/systems/BatchManager';
import { Drawcall } from '../../../packages/ecs/src/drawcalls/Drawcall';
import { SmoothPolyline } from '../../../packages/ecs/src/drawcalls/SmoothPolyline';
import { StrokeBatch } from '../../../packages/ecs/src/drawcalls/StrokeBatch';
import { PathDrawcall } from '../../../packages/ecs/src/drawcalls/PathDrawcall';
import {
  installCameraPhases,
  type CameraPhaseProbe,
} from './camera-phase-probe';

export function installECSCameraPhases(
  probe: CameraPhaseProbe,
  canvas: HTMLCanvasElement,
) {
  installCameraPhases(probe, canvas, [
    [ComputeCamera.prototype, 'execute', 'camera.derive'],
    [ComputeBounds.prototype, 'execute', 'bounds.derive'],
    [ViewportCulling.prototype, 'execute', 'visibility.cull'],
    [ComputeZIndex.prototype, 'execute', 'order.reconcile'],
    [Sort.prototype, 'execute', 'order.rank'],
    [MeshPipeline.prototype, 'renderCamera', 'render.camera'],
    [BatchManager.prototype, 'plan', 'batch.plan'],
    [BatchManager.prototype, 'flushDrawcalls', 'batch.submit'],
    [Drawcall.prototype, 'submit', 'drawcall.submit'],
    [PathDrawcall.prototype, 'prepareGeometry', 'path.precision'],
    [StrokeBatch.prototype, 'prepareGeometry', 'stroke.prepare'],
    [SmoothPolyline.prototype, 'createGeometry', 'stroke.geometry'],
  ]);
}
