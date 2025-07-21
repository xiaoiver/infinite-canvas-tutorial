import { field, Type } from '@lastolivegames/becsy';
import { mat3, vec2 } from 'gl-matrix';

export class ComputedCameraControl {
  @field({ type: Type.object, default: mat3.create() })
  declare startInvertViewProjectionMatrix: mat3;
  @field({ type: Type.float32, default: 0 }) declare startCameraX: number;
  @field({ type: Type.float32, default: 0 }) declare startCameraY: number;
  @field({ type: Type.float32, default: 0 })
  declare startCameraRotation: number;
  @field({ type: Type.object, default: vec2.create() }) declare startPos: vec2;
  @field({ type: Type.object, default: vec2.create() })
  declare startMousePos: vec2;
  @field({ type: Type.boolean, default: false }) declare rotate: boolean;

  @field.float32 declare pointerDownViewportX: number;
  @field.float32 declare pointerDownViewportY: number;
  @field.float32 declare pointerDownCanvasX: number;
  @field.float32 declare pointerDownCanvasY: number;
  // @field.float32 declare pointerMoveViewportX: number;
  // @field.float32 declare pointerMoveViewportY: number;
}
