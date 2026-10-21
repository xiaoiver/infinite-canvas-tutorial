import type { Buffer } from '@infinite-canvas-tutorial/device-api';
import { mat4 } from 'gl-matrix';
import type {
  Material3D,
  Material3DTextureTransform,
} from '../../components/geometry3d/Material3D';
import type { Transform3D } from '../../components/geometry3d/Transform3D';
import { ENVIRONMENT_IRRADIANCE_FLOATS } from '../../utils/environment-irradiance';

export const MESH_MODEL_UNIFORM_FLOATS = 108 + ENVIRONMENT_IRRADIANCE_FLOATS;

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
    u_ShadowReceive: this.data.subarray(
      60 + ENVIRONMENT_IRRADIANCE_FLOATS,
      64 + ENVIRONMENT_IRRADIANCE_FLOATS,
    ),
    u_TextureCoords: this.data.subarray(
      64 + ENVIRONMENT_IRRADIANCE_FLOATS,
      68 + ENVIRONMENT_IRRADIANCE_FLOATS,
    ),
    u_MapUvTransform: this.data.subarray(
      68 + ENVIRONMENT_IRRADIANCE_FLOATS,
      72 + ENVIRONMENT_IRRADIANCE_FLOATS,
    ),
    u_PbrUvTransform: this.data.subarray(
      72 + ENVIRONMENT_IRRADIANCE_FLOATS,
      76 + ENVIRONMENT_IRRADIANCE_FLOATS,
    ),
    u_UvRotations: this.data.subarray(
      76 + ENVIRONMENT_IRRADIANCE_FLOATS,
      80 + ENVIRONMENT_IRRADIANCE_FLOATS,
    ),
    u_EmissiveFactor: this.data.subarray(
      80 + ENVIRONMENT_IRRADIANCE_FLOATS,
      84 + ENVIRONMENT_IRRADIANCE_FLOATS,
    ),
    u_EmissiveUvTransform: this.data.subarray(
      84 + ENVIRONMENT_IRRADIANCE_FLOATS,
      88 + ENVIRONMENT_IRRADIANCE_FLOATS,
    ),
    u_EmissiveParams: this.data.subarray(
      88 + ENVIRONMENT_IRRADIANCE_FLOATS,
      92 + ENVIRONMENT_IRRADIANCE_FLOATS,
    ),
    u_NormalUvTransform: this.data.subarray(
      92 + ENVIRONMENT_IRRADIANCE_FLOATS,
      96 + ENVIRONMENT_IRRADIANCE_FLOATS,
    ),
    u_OcclusionUvTransform: this.data.subarray(
      96 + ENVIRONMENT_IRRADIANCE_FLOATS,
      100 + ENVIRONMENT_IRRADIANCE_FLOATS,
    ),
    u_NormalParams: this.data.subarray(
      100 + ENVIRONMENT_IRRADIANCE_FLOATS,
      104 + ENVIRONMENT_IRRADIANCE_FLOATS,
    ),
    u_OcclusionParams: this.data.subarray(
      104 + ENVIRONMENT_IRRADIANCE_FLOATS,
      108 + ENVIRONMENT_IRRADIANCE_FLOATS,
    ),
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
      emissiveMapReady: boolean;
      metallicRoughnessMapReady: boolean;
      normalMapReady: boolean;
      occlusionMapReady: boolean;
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
    this.set(64 + ENVIRONMENT_IRRADIANCE_FLOATS, material.mapTexCoord);
    this.set(
      65 + ENVIRONMENT_IRRADIANCE_FLOATS,
      material.metallicRoughnessTexCoord,
    );
    this.setTextureTransform(
      68 + ENVIRONMENT_IRRADIANCE_FLOATS,
      76 + ENVIRONMENT_IRRADIANCE_FLOATS,
      material.mapTextureTransform,
    );
    this.setTextureTransform(
      72 + ENVIRONMENT_IRRADIANCE_FLOATS,
      77 + ENVIRONMENT_IRRADIANCE_FLOATS,
      material.metallicRoughnessTextureTransform,
    );
    for (let i = 0; i < 3; i++)
      this.set(
        80 + ENVIRONMENT_IRRADIANCE_FLOATS + i,
        material.emissiveFactor[i],
      );
    this.set(
      83 + ENVIRONMENT_IRRADIANCE_FLOATS,
      Number(textureReady.emissiveMapReady),
    );
    this.setTextureTransform(
      84 + ENVIRONMENT_IRRADIANCE_FLOATS,
      89 + ENVIRONMENT_IRRADIANCE_FLOATS,
      material.emissiveTextureTransform,
    );
    this.set(88 + ENVIRONMENT_IRRADIANCE_FLOATS, material.emissiveTexCoord);
    this.set(90 + ENVIRONMENT_IRRADIANCE_FLOATS, material.emissiveStrength);
    this.set(91 + ENVIRONMENT_IRRADIANCE_FLOATS, Number(material.unlit));
    this.set(66 + ENVIRONMENT_IRRADIANCE_FLOATS, Number(material.doubleSided));
    this.setTextureTransform(
      92 + ENVIRONMENT_IRRADIANCE_FLOATS,
      102 + ENVIRONMENT_IRRADIANCE_FLOATS,
      material.normalTextureTransform,
    );
    this.setTextureTransform(
      96 + ENVIRONMENT_IRRADIANCE_FLOATS,
      106 + ENVIRONMENT_IRRADIANCE_FLOATS,
      material.occlusionTextureTransform,
    );
    this.set(
      100 + ENVIRONMENT_IRRADIANCE_FLOATS,
      Number(textureReady.normalMapReady),
    );
    this.set(101 + ENVIRONMENT_IRRADIANCE_FLOATS, material.normalTexCoord);
    this.set(103 + ENVIRONMENT_IRRADIANCE_FLOATS, material.normalScale);
    this.set(
      104 + ENVIRONMENT_IRRADIANCE_FLOATS,
      Number(textureReady.occlusionMapReady),
    );
    this.set(105 + ENVIRONMENT_IRRADIANCE_FLOATS, material.occlusionTexCoord);
    this.set(107 + ENVIRONMENT_IRRADIANCE_FLOATS, material.occlusionStrength);
    this.set(
      63 + ENVIRONMENT_IRRADIANCE_FLOATS,
      Number(textureReady.metallicRoughnessMapReady),
    );
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
    this.set(64 + ENVIRONMENT_IRRADIANCE_FLOATS, material.mapTexCoord);
    this.setTextureTransform(
      68 + ENVIRONMENT_IRRADIANCE_FLOATS,
      76 + ENVIRONMENT_IRRADIANCE_FLOATS,
      material.mapTextureTransform,
    );
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
      u_TextureCoords: this.legacy.u_TextureCoords,
      u_MapUvTransform: this.legacy.u_MapUvTransform,
      u_PbrUvTransform: this.legacy.u_PbrUvTransform,
      u_UvRotations: this.legacy.u_UvRotations,
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

  private setTextureTransform(
    offset: number,
    rotationOffset: number,
    transform: Material3DTextureTransform | null,
  ): void {
    const [u, v] = transform?.offset ?? [0, 0];
    const [su, sv] = transform?.scale ?? [1, 1];
    this.set(offset, u);
    this.set(offset + 1, v);
    this.set(offset + 2, su);
    this.set(offset + 3, sv);
    this.set(rotationOffset, transform?.rotation ?? 0);
  }

  private setAlpha(material: Material3D, mapReady: boolean): void {
    this.set(48, Number(mapReady));
    this.set(
      61 + ENVIRONMENT_IRRADIANCE_FLOATS,
      material.alphaMode === 'mask'
        ? 1
        : material.alphaMode === 'blend'
        ? 2
        : 0,
    );
    this.set(
      62 + ENVIRONMENT_IRRADIANCE_FLOATS,
      Number.isFinite(material.alphaCutoff)
        ? Math.max(0, Math.min(1, material.alphaCutoff))
        : 0.5,
    );
  }
}
