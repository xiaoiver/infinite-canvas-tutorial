import type { Buffer } from '@infinite-canvas-tutorial/device-api';
import { mat4 } from 'gl-matrix';
import type { Material3D } from '../../components/geometry3d/Material3D';
import type { Transform3D } from '../../components/geometry3d/Transform3D';
import { ENVIRONMENT_IRRADIANCE_FLOATS } from '../../utils/environment-irradiance';

export const MESH_MODEL_UNIFORM_FLOATS = 64 + ENVIRONMENT_IRRADIANCE_FLOATS;

/** One cache per model UBO; never retain mutable ECS component views. */
export class MeshModelUniforms {
  private readonly data = new Float32Array(MESH_MODEL_UNIFORM_FLOATS);
  private readonly bytes = new Uint8Array(this.data.buffer);
  private readonly pose = new Float64Array(9);
  private readonly values: number[] = [];
  private initialized = false;
  private dirty = true;
  private readonly model = this.data.subarray(0, 16);
  private readonly normal = this.data.subarray(16, 32);
  private readonly legacy = {
    u_ModelMatrix3D: this.model,
    u_NormalMatrix3D: this.normal,
    u_BaseColor: this.data.subarray(32, 36),
    u_LightParams: this.data.subarray(36, 40),
    u_LightDirection: this.data.subarray(40, 44),
    u_CanvasAnchor: this.data.subarray(44, 48),
    u_MaterialFlags: this.data.subarray(48, 52),
    u_PbrParams: this.data.subarray(52, 56),
    u_SideColor: this.data.subarray(56, 60),
    u_EnvironmentIrradiance: this.data.subarray(
      60,
      60 + ENVIRONMENT_IRRADIANCE_FLOATS,
    ),
    u_ShadowReceive: this.data.subarray(60 + ENVIRONMENT_IRRADIANCE_FLOATS),
  };

  constructor(private readonly buffer: Buffer) {
    this.data.set([-0.5, -0.7, -0.5, 0], 40);
  }

  update(
    transform: Transform3D,
    material: Material3D,
    textureReady: {
      mapReady: boolean;
      specularMapReady: boolean;
      bumpMapReady: boolean;
      environmentMapReady: boolean;
      environmentIrradiance: Float32Array | null;
    },
  ): Record<string, unknown> {
    this.updatePose(transform);
    for (let i = 0; i < 4; i++) this.set(32 + i, material.baseColor[i]);
    this.set(36, material.ambient);
    this.set(37, material.diffuse);
    this.set(38, material.specular);
    this.set(39, material.shininess);
    this.set(49, Number(textureReady.specularMapReady));
    this.set(50, Number(textureReady.bumpMapReady));
    this.set(51, material.bumpScale);
    this.set(52, material.metallic);
    this.set(53, material.roughness);
    this.set(54, Number(material.sideColor !== null));
    this.set(55, Number(textureReady.environmentMapReady));
    for (let i = 0; i < 4; i++) this.set(56 + i, material.sideColor?.[i] ?? 0);
    for (let i = 0; i < ENVIRONMENT_IRRADIANCE_FLOATS; i++)
      this.set(60 + i, textureReady.environmentIrradiance?.[i] ?? 0);
    this.set(
      60 + ENVIRONMENT_IRRADIANCE_FLOATS,
      Number(material.receiveShadow),
    );
    this.setAlpha(material, textureReady.mapReady);
    this.upload();
    return this.legacy;
  }

  /** Shadow maps render before the color pass; refresh alpha without loading IBL. */
  updateShadowMaterial(
    transform: Transform3D,
    material: Material3D,
    mapReady: boolean,
  ): void {
    this.updatePose(transform);
    this.set(32 + 3, material.baseColor[3]);
    this.set(54, Number(material.sideColor !== null));
    for (let i = 0; i < 4; i++) this.set(56 + i, material.sideColor?.[i] ?? 0);
    this.setAlpha(material, mapReady);
    this.upload();
  }

  /** Shadow pass only needs the first mat4; preserve cached material values. */
  updatePoseOnly(transform: Transform3D): void {
    this.updatePose(transform);
    this.upload();
  }

  getModelMatrix(): Float32Array {
    return this.model;
  }

  getShadowUniforms(): Record<string, unknown> {
    return {
      u_ShadowModelMatrix: this.model,
      u_BaseColor: this.legacy.u_BaseColor,
      u_MaterialFlags: this.legacy.u_MaterialFlags,
      u_PbrParams: this.legacy.u_PbrParams,
      u_SideColor: this.legacy.u_SideColor,
      u_ShadowReceive: this.legacy.u_ShadowReceive,
    };
  }

  private updatePose(transform: Transform3D): void {
    let poseChanged = !this.initialized;
    for (let i = 0; i < 9; i++) {
      const value =
        i < 3
          ? transform.translation[i]
          : i < 6
          ? transform.rotation[i - 3]
          : transform.scale[i - 6];
      if (!Object.is(this.pose[i], value)) poseChanged = true;
      this.pose[i] = value;
    }
    if (poseChanged) {
      mat4.identity(this.model);
      mat4.translate(this.model, this.model, transform.translation);
      mat4.rotateX(this.model, this.model, transform.rotation[0]);
      mat4.rotateY(this.model, this.model, transform.rotation[1]);
      mat4.rotateZ(this.model, this.model, transform.rotation[2]);
      mat4.scale(this.model, this.model, transform.scale);
      // A singular transform must not retain the previous inverse matrix.
      mat4.identity(this.normal);
      mat4.invert(this.normal, this.model);
      mat4.transpose(this.normal, this.normal);
      this.data.set(transform.translation, 44);
      this.initialized = true;
      this.dirty = true;
    }
  }

  private upload(): void {
    if (this.dirty) {
      this.buffer.setSubData(0, this.bytes);
      // A failed upload must be retried, even if inputs have not changed.
      this.dirty = false;
    }
  }

  private set(offset: number, value: number): void {
    if (Object.is(this.values[offset], value)) return;
    this.values[offset] = value;
    this.data[offset] = value;
    this.dirty = true;
  }

  private setAlpha(material: Material3D, mapReady: boolean): void {
    this.set(48, Number(mapReady));
    this.set(
      61 + ENVIRONMENT_IRRADIANCE_FLOATS,
      material.alphaMode === 'mask' ? 1 : material.alphaMode === 'blend' ? 2 : 0,
    );
    this.set(
      62 + ENVIRONMENT_IRRADIANCE_FLOATS,
      Number.isFinite(material.alphaCutoff)
        ? Math.max(0, Math.min(1, material.alphaCutoff))
        : 0.5,
    );
  }
}
