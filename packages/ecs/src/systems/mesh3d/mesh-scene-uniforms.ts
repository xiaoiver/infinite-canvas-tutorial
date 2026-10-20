import type { Buffer } from '@infinite-canvas-tutorial/device-api';
import type { Entity } from '@lastolivegames/becsy';
import { Camera, Camera3D, Canvas, ComputedCamera } from '../../components';
import { LIGHT_3D_TYPE, Light3D } from '../../components/geometry3d/Light3D';
import type { Mat3 } from '../../components/math/Mat3';
import { buildCamera3DSceneUniforms } from '../../utils/mesh3d-scene';

export const MAX_SHADOW_LIGHTS = 2;
export const MESH_SCENE_UNIFORM_FLOATS = 428;
const MAX_LIGHTS = 8;
const defaultAmbient = new Light3D({ type: 'ambient' });
const defaultDirectional = new Light3D({ type: 'directional' });

/** Light colors are authored in sRGB; scene radiance is accumulated in linear space. */
function linearChannel(value: number): number {
  const color = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  return color <= 0.04045 ? color / 12.92 : ((color + 0.055) / 1.055) ** 2.4;
}

function validDirection(direction: readonly number[]): number[] {
  return direction.every(Number.isFinite) && Math.hypot(...direction) > 1e-8
    ? [...direction]
    : [...defaultDirectional.direction];
}

/** Keep the spotlight's shading cone and shadow projection in agreement. */
export function spotConeAngles(innerAngle: number, outerAngle: number) {
  // Preserve a representable gap between the two cosine values in float32.
  const coneGap = 0.01;
  const inner = Number.isFinite(innerAngle)
    ? Math.max(0, Math.min(Math.PI - coneGap * 2, innerAngle))
    : Math.PI / 8;
  const outer = Number.isFinite(outerAngle)
    ? Math.max(inner + coneGap, Math.min(Math.PI - coneGap, outerAngle))
    : Math.max(inner + coneGap, Math.PI / 4);
  return { inner, outer };
}

function same(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
}

function appendMatrix(values: number[], m: Mat3): void {
  values.push(m.m00, m.m01, m.m02, m.m10, m.m11, m.m12, m.m20, m.m21, m.m22);
}

/** One scene UBO per canvas. Snapshot numbers, never mutable ECS views. */
export class MeshSceneUniforms {
  private readonly data = new Float32Array(MESH_SCENE_UNIFORM_FLOATS);
  private readonly bytes = new Uint8Array(this.data.buffer);
  private readonly inputs: number[] = [];
  private cameraInputs: number[] = [];
  private lightInputs: number[] = [-1];
  private shadowInputs: number[] = [];
  private readonly ambient = [0, 0, 0, 1];
  private dirty = true;
  private readonly legacy = {
    u_ProjectionMatrix3D: this.data.subarray(0, 16),
    u_ViewMatrix3D: this.data.subarray(16, 32),
    u_CanvasViewProjection3D: this.data.subarray(32, 48),
    u_SceneParams: this.data.subarray(48, 52),
    u_AmbientLight: this.data.subarray(52, 56),
    u_LightCount: this.data.subarray(56, 60),
    u_LightPositions: this.data.subarray(60, 92),
    u_LightDirections: this.data.subarray(92, 124),
    u_LightColors: this.data.subarray(124, 156),
    u_LightParams3D: this.data.subarray(156, 188),
    u_ShadowViewProjection: this.data.subarray(188, 220),
    u_ShadowParams: this.data.subarray(220, 228),
    u_ShadowFaces: this.data.subarray(228, 420),
    u_ShadowOptions: this.data.subarray(420, MESH_SCENE_UNIFORM_FLOATS),
  };

  constructor(private readonly buffer: Buffer) {}

  update(
    camera: Camera3D,
    aspect: number,
    cam2d: Entity | undefined,
    lights: readonly Entity[],
    shadows?: readonly {
      viewProjection: Float32Array;
      lightIndex: number;
      texelSize: number;
      faces?: readonly Float32Array[];
      strength?: number;
      softness?: number;
      biasScale?: number;
      normalBias?: number;
    }[],
  ): Record<string, unknown> {
    const values = this.inputs;
    values.length = 0;
    const linked = camera.linked && cam2d;
    values.push(Number(camera.projection === 'orthographic'), camera.far);
    if (linked) {
      values.push(1);
      const computed = cam2d.read(ComputedCamera);
      appendMatrix(values, computed.viewProjectionMatrix);
      if (camera.projection === 'perspective') {
        const canvas = cam2d.read(Camera).canvas;
        values.push(
          aspect,
          camera.near,
          camera.fovy,
          computed.x,
          computed.y,
          computed.zoom,
          canvas ? canvas.read(Canvas).height : 0,
        );
        appendMatrix(values, computed.viewMatrix);
      }
    } else {
      values.push(
        0,
        aspect,
        camera.near,
        camera.fovy,
        ...camera.eye,
        ...camera.center,
        ...camera.up,
      );
    }
    if (!same(values, this.cameraInputs)) {
      const scene = buildCamera3DSceneUniforms(camera, aspect, cam2d);
      this.data.set(scene.projMatrix.toFloat32Array(), 0);
      this.data.set(scene.viewMatrix.toFloat32Array(), 16);
      this.data.set(scene.canvasViewProjection.toFloat32Array(), 32);
      this.data.set(scene.sceneParams, 48);
      this.cameraInputs = values.slice();
      this.dirty = true;
    }

    values.length = 0;
    for (const entity of lights) {
      const light = entity.read(Light3D);
      values.push(
        light.type === 'ambient' ? 0 : LIGHT_3D_TYPE[light.type],
        ...light.color,
        light.intensity,
        ...light.position,
        ...light.direction,
        light.range,
        Number(light.attenuation === 'inverse-square'),
        light.referenceDistance,
        light.innerConeAngle,
        light.outerConeAngle,
      );
    }
    if (!same(values, this.lightInputs)) {
      this.packLights(lights);
      this.lightInputs = values.slice();
      this.dirty = true;
    }
    const shadowValues = shadows?.flatMap((shadow) => [
      ...shadow.viewProjection,
      shadow.lightIndex + 1,
      shadow.texelSize,
      Number(!!shadow.faces),
      shadow.strength ?? 1,
      shadow.softness ?? 1,
      shadow.biasScale ?? 1,
      shadow.normalBias ?? 0,
      ...(shadow.faces?.flatMap((face) => [...face]) ?? []),
    ]) ?? [0];
    if (!same(shadowValues, this.shadowInputs)) {
      this.data.fill(0, 188, MESH_SCENE_UNIFORM_FLOATS);
      shadows?.slice(0, MAX_SHADOW_LIGHTS).forEach((shadow, slot) => {
        this.data.set(shadow.viewProjection, 188 + slot * 16);
        this.data[220 + slot * 4] = shadow.lightIndex + 1;
        this.data[221 + slot * 4] = shadow.texelSize;
        this.data[222 + slot * 4] = Number(!!shadow.faces);
        this.data[420 + slot * 4] = Number.isFinite(shadow.strength)
          ? Math.max(0, Math.min(1, shadow.strength!))
          : 1;
        this.data[421 + slot * 4] = Number.isFinite(shadow.softness)
          ? Math.max(0, Math.min(4, shadow.softness!))
          : 1;
        this.data[422 + slot * 4] = Number.isFinite(shadow.biasScale)
          ? Math.max(0, Math.min(4, shadow.biasScale!))
          : 1;
        this.data[423 + slot * 4] = Number.isFinite(shadow.normalBias)
          ? Math.max(0, Math.min(10, shadow.normalBias!))
          : 0;
        shadow.faces?.forEach((face, index) =>
          this.data.set(face, 228 + (slot * 6 + index) * 16),
        );
      });
      this.shadowInputs = shadowValues;
      this.dirty = true;
    }
    if (this.dirty) {
      this.buffer.setSubData(0, this.bytes);
      // Keep dirty on failure so unchanged inputs can retry the upload.
      this.dirty = false;
    }
    return this.legacy;
  }

  private packLights(lights: readonly Entity[]): void {
    this.data.fill(0, 52, 188);
    this.ambient.fill(0, 0, 3);
    if (!lights.length) {
      this.addLight(defaultAmbient);
      this.addLight(defaultDirectional);
    } else {
      for (const entity of lights) {
        const light = entity.read(Light3D);
        this.addLight(light);
      }
    }
    this.data.set(this.ambient, 52);
  }

  private addLight(light: Light3D): void {
    const color = light.color.map(linearChannel);
    const intensity = Number.isFinite(light.intensity)
      ? Math.max(0, light.intensity)
      : 0;
    if (light.type === 'ambient') {
      for (let i = 0; i < 3; i++) this.ambient[i] += color[i] * intensity;
      return;
    }
    const count = this.data[56];
    if (count >= MAX_LIGHTS) return;
    const offset = count * 4;
    this.data.set(
      light.position.map((value) => (Number.isFinite(value) ? value : 0)),
      60 + offset,
    );
    this.data[63 + offset] =
      (light.type === 'point' || light.type === 'spot') &&
      light.attenuation === 'inverse-square'
        ? Number.isFinite(light.referenceDistance) &&
          light.referenceDistance > 0
          ? light.referenceDistance
          : 100
        : 0;
    this.data.set(validDirection(light.direction), 92 + offset);
    this.data.set(color, 124 + offset);
    this.data[156 + offset] = LIGHT_3D_TYPE[light.type];
    this.data[157 + offset] = intensity;
    this.data[158 + offset] = Number.isFinite(light.range)
      ? Math.max(0, light.range)
      : 0;
    if (light.type === 'spot') {
      const { inner, outer } = spotConeAngles(
        light.innerConeAngle,
        light.outerConeAngle,
      );
      this.data[95 + offset] = Math.cos(outer);
      this.data[159 + offset] = Math.cos(inner);
    }
    this.data[56] = count + 1;
  }
}
