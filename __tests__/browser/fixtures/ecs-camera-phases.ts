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
import { ImageBatch } from '../../../packages/ecs/src/drawcalls/ImageBatch';
import { PathInstances } from '../../../packages/ecs/src/drawcalls/PathInstances';
import { TextBatch } from '../../../packages/ecs/src/drawcalls/TextBatch';
import { SDF } from '../../../packages/ecs/src/drawcalls/SDF';
import { ShadowRect } from '../../../packages/ecs/src/drawcalls/ShadowRect';
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
    [BatchManager.prototype, 'resolveDrawcalls', 'batch.resolve', 'batch.plan'],
    [BatchManager.prototype, 'batchKey', 'batch.key', 'batch.plan'],
    [ImageBatch, 'batchKey', 'material.image', 'batch.plan'],
    [PathInstances, 'batchKey', 'material.path', 'batch.plan'],
    [StrokeBatch, 'batchKey', 'material.stroke', 'batch.plan'],
    [TextBatch, 'batchKey', 'material.text', 'batch.plan'],
    [SDF, 'batchKey', 'material.sdf', 'batch.plan'],
    [Drawcall, 'batchKey', 'material.default', 'batch.plan'],
    [SmoothPolyline, 'check', 'channel.stroke', 'batch.plan'],
    [ShadowRect, 'check', 'channel.shadow', 'batch.plan'],
    [TextBatch, 'instanceCount', 'batch.instances.text', 'batch.plan'],
    [Drawcall, 'instanceCount', 'batch.instances.default', 'batch.plan'],
    [ImageBatch, 'canAppend', 'batch.append.image', 'batch.plan'],
    [BatchManager.prototype, 'flushDrawcalls', 'batch.submit'],
    [Drawcall.prototype, 'submit', 'drawcall.submit'],
    [PathDrawcall.prototype, 'prepareGeometry', 'path.precision'],
    [StrokeBatch.prototype, 'prepareGeometry', 'stroke.prepare'],
    [SmoothPolyline.prototype, 'createGeometry', 'stroke.geometry'],
  ]);
}
