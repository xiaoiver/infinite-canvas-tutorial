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
}
