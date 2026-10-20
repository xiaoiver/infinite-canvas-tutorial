import { Entity, System } from '@lastolivegames/becsy';
import type { Device, RenderPass } from '@infinite-canvas-tutorial/device-api';
import {
  BlendFactor,
  BlendMode,
  Buffer,
  BufferFrequencyHint,
  BufferUsage,
  ChannelWriteMask,
  CompareFunction,
  CullMode,
  Format,
  InputLayout,
  PrimitiveTopology,
  Program,
  RenderPipeline,
  Sampler,
  Texture,
  TextureUsage,
  AddressMode,
  FilterMode,
  MipmapFilterMode,
  OpaqueWhite,
  TransparentBlack,
  VertexStepMode,
  TransparentWhite,
  makeMegaState,
} from '@infinite-canvas-tutorial/device-api';
import {
  Camera,
  Camera3D,
  Canvas,
  Canvas3DScope,
  ComputedCamera,
  Extrude3D,
  GPUResource,
  Light3D,
  Mesh3D,
  Material3D,
  Transform3D,
  ToBeDeleted,
} from '../components';
import {
  findCamera2DForCanvas,
  findCamera3DForCanvas,
  filterEntitiesForCanvas,
} from '../utils/canvas3d-scope';
import { isEntityAlive } from './Transform';
import type { RenderCache } from '../utils/render-cache';
import { makeAttachmentClearDescriptor } from '../render-graph/utils';
import { vert, frag } from '../shaders/mesh3d';
import { vert as shadowVert, frag as shadowFrag } from '../shaders/shadow3d';
import type { RGGraphBuilder } from '../render-graph/interface';
import { RGAttachmentSlot } from '../render-graph/interface';
import { RGRenderTargetDescription } from '../render-graph/RenderTargetDescription';
import { loadImageBitmapUniversal } from '../utils/load-image-bitmap';
import {
  ENVIRONMENT_BRDF_SIZE,
  environmentBrdfPixels,
} from '../utils/environment-brdf';
import { DOMAdapter } from '../environment';
import {
  decodeRadianceHDR,
  environmentFromBitmap,
  ENV_ATLAS_HEIGHT,
  ENV_ATLAS_WIDTH,
  prefilterEnvironment,
} from '../utils/environment-map';
import {
  getMeshPipeline3D,
  registerMeshPipeline3D,
  syncMeshPipeline3DCanvases,
  unregisterMeshPipeline3D,
} from './mesh3d-bridge';
import { RenderGizmo3D } from './RenderGizmo3D';
import { MeshGPUCache, type MeshGPUData } from './mesh3d/mesh-gpu-cache';
import {
  fitDirectionalShadow,
  fitPointShadow,
  fitSpotShadow,
  intersectsShadowFrustum,
  meshWorldCorners,
  type ShadowCasterBounds,
  SHADOW_MAP_SIZE,
  POINT_SHADOW_FACE_SIZE,
  POINT_SHADOW_COLUMNS,
  POINT_SHADOW_ROWS,
} from './mesh3d/shadow-projection';
import { ResourceScope } from '../resources/ResourceScope';
import type { API } from '../API';
import { vec4 } from 'gl-matrix';

import {
  MeshSceneUniforms,
  MESH_SCENE_UNIFORM_FLOATS,
  MAX_SHADOW_LIGHTS,
  spotConeAngles,
} from './mesh3d/mesh-scene-uniforms';

/** Async base-color texture state, cached per canvas owner + URL. */
interface TextureCacheEntry {
  texture: Texture;
  status: 'loading' | 'ready' | 'error';
  irradiance: Float32Array | null;
}

/** Each canvas owns its uniforms, geometry cache and loaded textures. */
interface MeshPipeline3DCanvasState {
  device: Device;
  renderCache: RenderCache;
  owner: ResourceScope;
  dispose: () => void;
  program: Program;
  pipeline: RenderPipeline;
  blendPipeline: RenderPipeline;
  inputLayout: InputLayout;
  sceneUniformBuffer: Buffer;
  sceneUniforms: MeshSceneUniforms;
  meshGPUCache: MeshGPUCache;
  /** 1x1 opaque-white fallback for meshes without a base-color texture. */
  whiteTexture: Texture;
  /** Shared sampler for base-color textures. */
  sampler: Sampler;
  brdfSampler: Sampler;
  brdfTexture?: Texture;
  brdfResources: ResourceScope;
  shadowSampler: Sampler;
  shadowProgram: Program;
  shadowPipeline: RenderPipeline;
  shadowInputLayout: InputLayout;
  shadowSceneBuffers?: Buffer[];
  shadowResources: ResourceScope;
  /** Loaded base-color textures keyed by URL. */
  textureCache: Map<string, TextureCacheEntry>;
}

export interface ShadowFrame {
  viewProjection: Float32Array;
  faces?: Float32Array[];
  lightIndex: number;
  strength: number;
  softness: number;
  biasScale: number;
  normalBias: number;
  resolveID: number;
}

/**
 * 3D mesh rendering. Draw calls are injected into {@link MeshPipeline}'s render
 * graph (3D pass, then 2D/grid on the same color target) so the backbuffer is
 * composited once. GPU buffers are cached per Mesh3D entity and canvas resource owner.
 */
export class MeshPipeline3D extends System {
  private gizmo = this.attach(RenderGizmo3D);

  private canvases = this.query((q) => q.current.with(Canvas).read);

  /** Read-only: camera uniforms are updated in {@link drawMeshes} at render time. */
  private cameras3D = this.query((q) => q.current.with(Camera3D).read);

  private cameras2D = this.query(
    (q) => q.current.with(Camera, ComputedCamera).read,
  );

  private meshes3D = this.query(
    (q) => q.current.and.removed.with(Mesh3D, Material3D, Transform3D).read,
  );

  private lights3D = this.query((q) => q.current.with(Light3D).read);

  private geometryDirty = this.query(
    (q) => q.addedOrChanged.with(Mesh3D).trackWrites,
  );

  private extrudeSources = this.query((q) => q.current.with(Extrude3D).read);

  private states = new Map<API, MeshPipeline3DCanvasState>();

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(Canvas3DScope, ToBeDeleted)
          .read.and.current.with(
            GPUResource,
            Canvas,
            Camera,
            Camera3D,
            ComputedCamera,
            Extrude3D,
            Light3D,
            Mesh3D,
            Material3D,
            Transform3D,
          ).read,
    );
  }

  initialize(): void {
    // A rejected World must not replace the renderer of an active canvas.
    registerMeshPipeline3D(this);
  }

  /** Prefer linked camera for this canvas when extrude meshes exist. */
  private resolveRenderCameraEntity(canvas: Entity): Entity | undefined {
    const canvasCount = this.canvases.current.length || 1;
    const scoped = findCamera3DForCanvas(
      this.cameras3D.current,
      canvas,
      canvasCount,
    );
    if (scoped) {
      return scoped;
    }

    const cameras = this.cameras3D.current;
    if (cameras.length === 0) {
      return undefined;
    }

    const canvasMeshes = this.collectMeshEntities(canvas);
    const hasExtrudeMeshes = this.extrudeSources.current.some((e) => {
      const mesh = e.read(Extrude3D).meshEntity;
      return mesh && isEntityAlive(mesh) && canvasMeshes.includes(mesh);
    });
    if (hasExtrudeMeshes) {
      const linked = cameras.find((c) => c.read(Camera3D).linked);
      if (linked) {
        return linked;
      }
    }
    return cameras[0];
  }

  /** Meshes belonging to {@link canvas}. */
  private collectMeshEntities(canvas: Entity): Entity[] {
    const canvasCount = this.canvases.current.length || 1;
    const out: Entity[] = [];
    const seen = new Set<number>();

    const add = (entity: Entity) => {
      if (
        seen.has(entity.__id) ||
        !isEntityAlive(entity) ||
        entity.has(ToBeDeleted) ||
        !entity.has(Mesh3D) ||
        !entity.has(Material3D) ||
        !entity.has(Transform3D) ||
        !filterEntitiesForCanvas([entity], canvas, canvasCount).length
      ) {
        return;
      }
      seen.add(entity.__id);
      out.push(entity);
    };

    for (const entity of this.meshes3D.current) {
      add(entity);
    }

    for (const source of this.extrudeSources.current) {
      const meshEntity = source.read(Extrude3D).meshEntity;
      if (meshEntity) {
        add(meshEntity);
      }
    }

    return out;
  }

  /** True when {@link canvas} has 3D content to draw. */
  has3DContent(canvas?: Entity): boolean {
    if (canvas) {
      return (
        !!findCamera3DForCanvas(
          this.cameras3D.current,
          canvas,
          this.canvases.current.length || 1,
        ) && this.collectMeshEntities(canvas).length > 0
      );
    }
    return this.canvases.current.some((c) => this.has3DContent(c));
  }

  /**
   * Create the mesh3d pipeline when content exists. Call from {@link MeshPipeline}
   * before building the render graph so `shouldComposite()` can be true same frame.
   */
  prepareForComposite(canvas: Entity): void {
    if (!this.has3DContent(canvas) || !canvas.has(GPUResource)) {
      return;
    }
    this.initPipeline(canvas);
  }

  /** True when 3D draw calls should run for {@link canvas}. */
  shouldComposite(canvas: Entity): boolean {
    if (!this.has3DContent(canvas) || !canvas.has(GPUResource)) {
      return false;
    }
    const state = this.states.get(canvas.read(Canvas).api);
    return !!state && this.matches(state, canvas);
  }

  /**
   * Draws all 3D meshes into an active render pass (same targets as 2D).
   * Called at the start of {@link MeshPipeline}'s main pass so color/depth are
   * cleared once and 2D keeps its GREATER depth convention on a fresh buffer.
   */
  drawMeshes(
    renderPass: RenderPass,
    canvas: Entity,
    width: number,
    height: number,
    shadowTextures: readonly Texture[] = [],
    shadowFrames: readonly ShadowFrame[] = [],
  ): void {
    if (width <= 0 || height <= 0) {
      return;
    }

    const state = this.initPipeline(canvas);
    if (!state || !this.shouldComposite(canvas)) {
      return;
    }

    const { device } = canvas.read(GPUResource);
    const cameraEntity = this.resolveRenderCameraEntity(canvas);
    if (!cameraEntity) {
      return;
    }
    const camera = cameraEntity.read(Camera3D);
    const canvasCount = this.canvases.current.length || 1;
    const cam2d = camera.linked
      ? findCamera2DForCanvas(this.cameras2D.current, canvas)
      : undefined;
    const { width: logicalW, height: logicalH } = canvas.read(Canvas);
    // Linked mode: ortho extents follow 2D logical canvas size (not DPR pixels).
    const aspect =
      camera.linked && logicalW > 0 && logicalH > 0
        ? logicalW / logicalH
        : width / height;
    const sceneLegacy = state.sceneUniforms.update(
      camera,
      aspect,
      cam2d,
      filterEntitiesForCanvas(this.lights3D.current, canvas, canvasCount),
      shadowFrames.slice(0, shadowTextures.length).map((frame) => ({
        viewProjection: frame.viewProjection,
        lightIndex: frame.lightIndex,
        texelSize: 1 / (frame.faces ? POINT_SHADOW_FACE_SIZE : SHADOW_MAP_SIZE),
        faces: frame.faces,
        strength: frame.strength,
        softness: frame.softness,
        biasScale: frame.biasScale,
        normalBias: frame.normalBias,
      })),
    );

    renderPass.setViewport(0, 0, width, height);
    const draw = (
      meshEntity: Entity,
      gpuData: MeshGPUData,
      pipeline: RenderPipeline,
    ) => {
      const material = meshEntity.read(Material3D);
      const { texture: baseColorTexture, ready: mapReady } =
        this.resolveMaterialTexture(state, device, material.map);
      const { texture: specularTexture, ready: specularMapReady } =
        this.resolveMaterialTexture(state, device, material.specularMap);
      const { texture: bumpTexture, ready: bumpMapReady } =
        this.resolveMaterialTexture(state, device, material.bumpMap);
      const {
        texture: environmentTexture,
        ready: environmentMapReady,
        irradiance: environmentIrradiance,
      } = this.resolveMaterialTexture(
        state,
        device,
        material.environmentMap,
        true,
      );

      const modelLegacy = gpuData.modelUniforms.update(
        meshEntity.read(Transform3D),
        meshEntity.read(Material3D),
        {
          mapReady,
          specularMapReady,
          bumpMapReady,
          environmentMapReady,
          environmentIrradiance,
        },
      );

      state.program.setUniformsLegacy({
        ...sceneLegacy,
        ...modelLegacy,
      });

      const bindings = gpuData.bindings.get(
        pipeline,
        state.sceneUniformBuffer,
        state.sampler,
        baseColorTexture,
        specularTexture,
        bumpTexture,
        environmentTexture,
        shadowTextures[0] ?? state.whiteTexture,
        shadowTextures[1] ?? state.whiteTexture,
        state.shadowSampler,
        environmentMapReady
          ? this.resolveEnvironmentBrdf(state)
          : state.whiteTexture,
        state.brdfSampler,
      );
      renderPass.setBindings(bindings);
      renderPass.setVertexInput(
        state.inputLayout,
        [
          { buffer: gpuData.vertexBuffer },
          { buffer: gpuData.normalBuffer },
          { buffer: gpuData.uvBuffer },
        ],
        gpuData.indexBuffer ? { buffer: gpuData.indexBuffer } : null,
      );

      if (gpuData.indexBuffer) {
        renderPass.drawIndexed(gpuData.indexCount);
      } else {
        renderPass.draw(gpuData.vertexCount);
      }
    };

    const blended: { entity: Entity; gpu: MeshGPUData; depth: number }[] = [];
    const view = sceneLegacy.u_ViewMatrix3D as Float32Array;
    // Linked canvas cameras look from negative z; standalone cameras use
    // their ordinary view direction. In either mode smaller keys are farther.
    const depthSign = camera.linked && cam2d ? -1 : 1;
    renderPass.setPipeline(state.pipeline);
    for (const meshEntity of this.collectMeshEntities(canvas)) {
      const gpu = state.meshGPUCache.get(
        meshEntity.__id,
        meshEntity.read(Mesh3D),
      );
      if (!gpu) continue;
      if (meshEntity.read(Material3D).alphaMode === 'blend') {
        gpu.modelUniforms.updatePoseOnly(meshEntity.read(Transform3D));
        const { min, max } = gpu.localBounds;
        const center = vec4.fromValues(
          (min[0] + max[0]) / 2,
          (min[1] + max[1]) / 2,
          (min[2] + max[2]) / 2,
          1,
        );
        vec4.transformMat4(center, center, gpu.modelUniforms.getModelMatrix());
        vec4.transformMat4(center, center, view);
        blended.push({
          entity: meshEntity,
          gpu,
          depth: center[2] * depthSign,
        });
      } else {
        draw(meshEntity, gpu, state.pipeline);
      }
    }
    if (blended.length) {
      // Draw farther translucent surfaces before nearer ones.
      blended.sort((a, b) => a.depth - b.depth || a.entity.__id - b.entity.__id);
      renderPass.setPipeline(state.blendPipeline);
      for (const { entity, gpu } of blended)
        draw(entity, gpu, state.blendPipeline);
    }

    // Draw 3D gizmos on top of meshes (depth disabled, always visible)
    const gizmo = this.gizmo;
    if (gizmo && gizmo.hasGizmoContent(canvas)) {
      gizmo.drawGizmos(renderPass, canvas, width, height);
    }
  }

  /** Add depth-map passes before the shared 3D/2D pass for up to two lights. */
  scheduleShadowPass(builder: RGGraphBuilder, canvas: Entity): ShadowFrame[] {
    const state = this.initPipeline(canvas);
    if (!state || !this.shouldComposite(canvas)) return [];
    const lights = filterEntitiesForCanvas(
      this.lights3D.current,
      canvas,
      this.canvases.current.length || 1,
    );
    const candidates: {
      type: 'directional' | 'point' | 'spot';
      lightIndex: number;
      position: [number, number, number];
      direction: [number, number, number];
      range: number;
      innerConeAngle: number;
      outerConeAngle: number;
      strength: number;
      softness: number;
      biasScale: number;
      normalBias: number;
    }[] = [];
    let lightIndex = 0;
    for (const entity of lights) {
      const light = entity.read(Light3D);
      if (light.type === 'ambient') continue;
      if (lightIndex >= 8) break;
      const index = lightIndex++;
      if (!light.castShadow || !(light.intensity > 0)) continue;
      const strength = Number.isFinite(light.shadowStrength)
        ? Math.max(0, Math.min(1, light.shadowStrength))
        : 1;
      if (strength <= 0) continue;
      // Becsy reuses component read views across entities. Keep values, not
      // the Light3D view, while mesh bounds are prepared below.
      candidates.push({
        type: light.type,
        lightIndex: index,
        position: [...light.position],
        direction: [...light.direction],
        range: light.range,
        innerConeAngle: light.innerConeAngle,
        outerConeAngle: light.outerConeAngle,
        strength,
        softness: Number.isFinite(light.shadowSoftness)
          ? Math.max(0, Math.min(4, light.shadowSoftness))
          : 1,
        biasScale: Number.isFinite(light.shadowBiasScale)
          ? Math.max(0, Math.min(4, light.shadowBiasScale))
          : 1,
        normalBias: Number.isFinite(light.shadowNormalBias)
          ? Math.max(0, Math.min(10, light.shadowNormalBias))
          : 0,
      });
    }
    if (!candidates.length) return [];
    const meshes = this.collectMeshEntities(canvas);
    const shadowCasters: Entity[] = [];
    const shadowReceiverIds: number[] = [];
    for (const entity of meshes) {
      const material = entity.read(Material3D);
      if (material.castShadow) shadowCasters.push(entity);
      if (material.receiveShadow) shadowReceiverIds.push(entity.__id);
    }
    // No shadow map can affect the scene without both a caster and receiver.
    if (!shadowCasters.length || !shadowReceiverIds.length) return [];
    const casterIds = shadowCasters.map((entity) => entity.__id);
    const boundsById = new Map<number, ShadowCasterBounds>();
    const gpuById = new Map<number, MeshGPUData>();
    const shadowTextureById = new Map<number, Texture>();
    const bounds = meshes.flatMap((entity) => {
      const gpu = state.meshGPUCache.get(entity.__id, entity.read(Mesh3D));
      if (!gpu) return [];
      const material = entity.read(Material3D);
      if (material.castShadow) {
        const { texture, ready } =
          material.alphaMode === 'opaque'
            ? { texture: state.whiteTexture, ready: false }
            : this.resolveMaterialTexture(state, state.device, material.map);
        gpu.modelUniforms.updateShadowMaterial(
          entity.read(Transform3D),
          entity.read(Material3D),
          ready,
        );
        shadowTextureById.set(entity.__id, texture);
      } else {
        gpu.modelUniforms.updatePoseOnly(entity.read(Transform3D));
      }
      gpuById.set(entity.__id, gpu);
      const bound: ShadowCasterBounds = {
        ...gpu.localBounds,
        model: gpu.modelUniforms.getModelMatrix(),
      };
      bound.corners = meshWorldCorners(bound);
      boundsById.set(entity.__id, bound);
      return [bound];
    });
    if (!shadowReceiverIds.some((id) => gpuById.has(id))) return [];
    const casterCorners = new Map<
      number,
      NonNullable<ShadowCasterBounds['corners']>
    >();
    for (const id of casterIds) {
      const bound = boundsById.get(id);
      if (bound?.corners) casterCorners.set(id, bound.corners);
    }
    const casters: {
      type: 'directional' | 'point' | 'spot';
      lightIndex: number;
      viewProjection: Float32Array;
      faces: Float32Array[] | null;
      visibleCasterIds: number[][];
      strength: number;
      softness: number;
      biasScale: number;
      normalBias: number;
    }[] = [];
    for (const candidate of candidates) {
      const { type, position, direction, range } = candidate;
      const outerConeAngle = spotConeAngles(
        candidate.innerConeAngle,
        candidate.outerConeAngle,
      ).outer;
      // A perspective shadow camera becomes singular as the spotlight's full
      // field of view approaches 180 degrees. Use the existing six-face map
      // for wide cones; the spotlight shader still clips illumination to its
      // authored cone, so the extra faces only provide depth coverage.
      const wideSpot =
        type === 'spot' && outerConeAngle >= (85 * Math.PI) / 180;
      if (
        wideSpot &&
        (!direction.every(Number.isFinite) || Math.hypot(...direction) < 1e-8)
      )
        continue;
      const faces =
        type === 'point' || wideSpot
          ? fitPointShadow(position, range, bounds)
          : null;
      const viewProjection =
        faces?.[0] ??
        (type === 'spot'
          ? fitSpotShadow(position, direction, outerConeAngle, range, bounds)
          : type === 'directional'
          ? fitDirectionalShadow(direction, bounds)
          : null);
      if (!viewProjection) continue;
      const visibleCasterIds = (faces ?? [viewProjection]).map((matrix) =>
        casterIds.filter((id) => {
          if (!gpuById.has(id)) return false;
          const corners = casterCorners.get(id);
          return !corners || intersectsShadowFrustum(corners, matrix);
        }),
      );
      // A light with no caster in any face contributes only direct lighting.
      if (!visibleCasterIds.some((ids) => ids.length)) continue;
      casters.push({
        type,
        lightIndex: candidate.lightIndex,
        viewProjection,
        faces,
        visibleCasterIds,
        strength: candidate.strength,
        softness: candidate.softness,
        biasScale: candidate.biasScale,
        normalBias: candidate.normalBias,
      });
      if (casters.length === MAX_SHADOW_LIGHTS) break;
    }
    if (!casters.length) return [];
    if (!state.shadowSceneBuffers) {
      state.shadowSceneBuffers = Array.from(
        { length: MAX_SHADOW_LIGHTS * 6 },
        () => {
          const buffer = state.device.createBuffer({
            viewOrSize: 16 * 4,
            usage: BufferUsage.UNIFORM,
            hint: BufferFrequencyHint.DYNAMIC,
          });
          state.shadowResources.add(() => buffer.destroy());
          return buffer;
        },
      );
    }
    return casters.map((caster, slot) => {
      const {
        type,
        lightIndex,
        viewProjection,
        faces,
        visibleCasterIds,
        strength,
        softness,
        biasScale,
        normalBias,
      } = caster;
      const matrices = faces ?? [viewProjection];
      const size = faces ? POINT_SHADOW_FACE_SIZE : SHADOW_MAP_SIZE;
      const targetWidth = faces ? size * POINT_SHADOW_COLUMNS : size;
      const targetHeight = faces ? size * POINT_SHADOW_ROWS : size;
      const color = new RGRenderTargetDescription(Format.U8_RGBA_RT);
      color.setDimensions(targetWidth, targetHeight, 1);
      // Packed depth uses alpha as its most significant channel. Empty texels
      // must decode to the far plane, not zero-depth transparent white.
      color.colorClearColor = OpaqueWhite;
      color.sampledForShaderRead = true;
      const depth = new RGRenderTargetDescription(Format.D24_S8);
      depth.setDimensions(targetWidth, targetHeight, 1);
      depth.depthClearValue = 1;
      depth.stencilClearValue = 0;
      const passName =
        type === 'spot'
          ? 'Spot Shadow'
          : type === 'point'
          ? 'Point Shadow'
          : 'Directional Shadow';
      const colorID = builder.createRenderTargetID(color, `${passName} Color`);
      const depthID = builder.createRenderTargetID(depth, `${passName} Depth`);
      builder.pushPass((pass) => {
        pass.setDebugName(`${passName} Map ${slot + 1}`);
        pass.attachRenderTargetID(RGAttachmentSlot.Color0, colorID);
        pass.attachRenderTargetID(RGAttachmentSlot.DepthStencil, depthID);
        pass.exec((renderPass) => {
          renderPass.setPipeline(state.shadowPipeline);
          matrices.forEach((matrix, face) => {
            const shadowSceneBuffer =
              state.shadowSceneBuffers![slot * 6 + face];
            shadowSceneBuffer.setSubData(0, new Uint8Array(matrix.buffer));
            state.shadowProgram.setUniformsLegacy({
              u_ShadowLightViewProjection: matrix,
            });
            renderPass.setViewport(
              (face % POINT_SHADOW_COLUMNS) * size,
              Math.floor(face / POINT_SHADOW_COLUMNS) * size,
              size,
              size,
            );
            for (const id of visibleCasterIds[face]) {
              // The pass executes after scheduling, when ECS read views may be
              // invalid. Geometry and pose were captured for this frame above.
              const gpu = gpuById.get(id);
              if (!gpu) continue;
              state.shadowProgram.setUniformsLegacy(
                gpu.modelUniforms.getShadowUniforms(),
              );
              renderPass.setBindings(
                gpu.shadowBindings.get(
                  state.shadowPipeline,
                  shadowSceneBuffer,
                  shadowTextureById.get(id) ?? state.whiteTexture,
                  state.sampler,
                ),
              );
              renderPass.setVertexInput(
                state.shadowInputLayout,
                [
                  { buffer: gpu.vertexBuffer },
                  { buffer: gpu.uvBuffer },
                  { buffer: gpu.normalBuffer },
                ],
                gpu.indexBuffer ? { buffer: gpu.indexBuffer } : null,
              );
              if (gpu.indexBuffer) renderPass.drawIndexed(gpu.indexCount);
              else renderPass.draw(gpu.vertexCount);
            }
          });
        });
      });
      return {
        viewProjection,
        faces: faces ?? undefined,
        lightIndex,
        strength,
        softness,
        biasScale,
        normalBias,
        resolveID: builder.resolveRenderTarget(colorID),
      };
    });
  }

  /** Color clear descriptor for the 3D pass (first pass in the shared graph). */
  getColorClearDescriptor(
    canvas: Entity,
  ): ReturnType<typeof makeAttachmentClearDescriptor> | undefined {
    if (!this.shouldComposite(canvas)) {
      return undefined;
    }
    const cameraEntity = this.resolveRenderCameraEntity(canvas);
    const camera = cameraEntity?.read(Camera3D);
    return camera?.clearColor
      ? makeAttachmentClearDescriptor(TransparentWhite)
      : undefined;
  }

  private matches(state: MeshPipeline3DCanvasState, canvas: Entity): boolean {
    if (!canvas.has(GPUResource)) return false;
    const { device, renderCache, scope } = canvas.read(GPUResource);
    return (
      state.device === device &&
      state.renderCache === renderCache &&
      state.owner === scope
    );
  }

  private initPipeline(canvas: Entity): MeshPipeline3DCanvasState | null {
    if (!canvas.has(GPUResource)) return null;
    const { api } = canvas.read(Canvas);
    const previous = this.states.get(api);
    if (previous && this.matches(previous, canvas)) return previous;
    previous?.dispose();
    const { device, renderCache, scope: owner } = canvas.read(GPUResource);
    const resources = new ResourceScope();
    const own = <T extends { destroy(): void }>(resource: T): T => {
      resources.add(() => resource.destroy());
      return resource;
    };
    try {
      const program = renderCache.createProgram({
        vertex: { glsl: vert, entryPoint: 'main' },
        fragment: { glsl: frag, entryPoint: 'main' },
      });

      const inputLayout = renderCache.createInputLayout({
        vertexBufferDescriptors: [
          {
            arrayStride: 3 * 4,
            stepMode: VertexStepMode.VERTEX,
            attributes: [
              {
                format: Format.F32_RGB,
                offset: 0,
                shaderLocation: 0,
              },
            ],
          },
          {
            arrayStride: 3 * 4,
            stepMode: VertexStepMode.VERTEX,
            attributes: [
              {
                format: Format.F32_RGB,
                offset: 0,
                shaderLocation: 1,
              },
            ],
          },
          {
            arrayStride: 2 * 4,
            stepMode: VertexStepMode.VERTEX,
            attributes: [
              {
                format: Format.F32_RG,
                offset: 0,
                shaderLocation: 2,
              },
            ],
          },
        ],
        indexBufferFormat: Format.U32_R,
        program,
      });

      const pipeline = renderCache.createRenderPipeline({
        inputLayout,
        program,
        colorAttachmentFormats: [Format.U8_RGBA_RT],
        depthStencilAttachmentFormat: Format.D24_S8,
        topology: PrimitiveTopology.TRIANGLES,
        megaStateDescriptor: makeMegaState({
          attachmentsState: [
            {
              channelWriteMask: ChannelWriteMask.ALL,
              rgbBlendState: {
                blendMode: BlendMode.ADD,
                blendSrcFactor: BlendFactor.ONE,
                blendDstFactor: BlendFactor.ZERO,
              },
              alphaBlendState: {
                blendMode: BlendMode.ADD,
                blendSrcFactor: BlendFactor.ONE,
                blendDstFactor: BlendFactor.ZERO,
              },
            },
          ],
          blendConstant: TransparentBlack,
          depthWrite: true,
          depthCompare: CompareFunction.GREATER,
          cullMode: CullMode.BACK,
        }),
      });

      const blendPipeline = renderCache.createRenderPipeline({
        inputLayout,
        program,
        colorAttachmentFormats: [Format.U8_RGBA_RT],
        depthStencilAttachmentFormat: Format.D24_S8,
        topology: PrimitiveTopology.TRIANGLES,
        megaStateDescriptor: makeMegaState({
          attachmentsState: [
            {
              channelWriteMask: ChannelWriteMask.ALL,
              rgbBlendState: {
                blendMode: BlendMode.ADD,
                blendSrcFactor: BlendFactor.SRC_ALPHA,
                blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
              },
              alphaBlendState: {
                blendMode: BlendMode.ADD,
                blendSrcFactor: BlendFactor.ONE,
                blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
              },
            },
          ],
          blendConstant: TransparentBlack,
          depthWrite: false,
          depthCompare: CompareFunction.GREATER,
          cullMode: CullMode.BACK,
        }),
      });

      const shadowProgram = renderCache.createProgram({
        vertex: { glsl: shadowVert, entryPoint: 'main' },
        fragment: { glsl: shadowFrag, entryPoint: 'main' },
      });
      const shadowInputLayout = renderCache.createInputLayout({
        vertexBufferDescriptors: [
          {
            arrayStride: 3 * 4,
            stepMode: VertexStepMode.VERTEX,
            attributes: [
              { format: Format.F32_RGB, offset: 0, shaderLocation: 0 },
            ],
          },
          {
            arrayStride: 2 * 4,
            stepMode: VertexStepMode.VERTEX,
            attributes: [
              { format: Format.F32_RG, offset: 0, shaderLocation: 1 },
            ],
          },
          {
            arrayStride: 3 * 4,
            stepMode: VertexStepMode.VERTEX,
            attributes: [
              { format: Format.F32_RGB, offset: 0, shaderLocation: 2 },
            ],
          },
        ],
        indexBufferFormat: Format.U32_R,
        program: shadowProgram,
      });
      const shadowPipeline = renderCache.createRenderPipeline({
        inputLayout: shadowInputLayout,
        program: shadowProgram,
        colorAttachmentFormats: [Format.U8_RGBA_RT],
        depthStencilAttachmentFormat: Format.D24_S8,
        topology: PrimitiveTopology.TRIANGLES,
        megaStateDescriptor: makeMegaState({
          depthWrite: true,
          depthCompare: CompareFunction.LESS,
          cullMode: CullMode.BACK,
        }),
      });
      const shadowResources = new ResourceScope();
      resources.add(() => shadowResources.dispose());
      const brdfResources = new ResourceScope();
      resources.add(() => brdfResources.dispose());

      const sceneUniformBuffer = own(
        device.createBuffer({
          viewOrSize: MESH_SCENE_UNIFORM_FLOATS * 4,
          usage: BufferUsage.UNIFORM,
          hint: BufferFrequencyHint.DYNAMIC,
        }),
      );

      const whiteTexture = own(
        device.createTexture({
          format: Format.U8_RGBA_NORM,
          width: 1,
          height: 1,
          usage: TextureUsage.SAMPLED,
        }),
      );
      whiteTexture.setImageData([new Uint8Array([255, 255, 255, 255])]);

      const sampler = renderCache.createSampler({
        addressModeU: AddressMode.REPEAT,
        addressModeV: AddressMode.CLAMP_TO_EDGE,
        minFilter: FilterMode.BILINEAR,
        magFilter: FilterMode.BILINEAR,
        mipmapFilter: MipmapFilterMode.LINEAR,
        lodMinClamp: 0,
        lodMaxClamp: 0,
      });
      const shadowSampler = renderCache.createSampler({
        addressModeU: AddressMode.CLAMP_TO_EDGE,
        addressModeV: AddressMode.CLAMP_TO_EDGE,
        minFilter: FilterMode.POINT,
        magFilter: FilterMode.POINT,
        mipmapFilter: MipmapFilterMode.NO_MIP,
        lodMinClamp: 0,
        lodMaxClamp: 0,
      });
      const brdfSampler = renderCache.createSampler({
        addressModeU: AddressMode.CLAMP_TO_EDGE,
        addressModeV: AddressMode.CLAMP_TO_EDGE,
        minFilter: FilterMode.BILINEAR,
        magFilter: FilterMode.BILINEAR,
        mipmapFilter: MipmapFilterMode.NO_MIP,
        lodMinClamp: 0,
        lodMaxClamp: 0,
      });

      const state: MeshPipeline3DCanvasState = {
        device,
        renderCache,
        owner,
        dispose: () => {},
        program,
        pipeline,
        blendPipeline,
        inputLayout,
        sceneUniformBuffer,
        sceneUniforms: new MeshSceneUniforms(sceneUniformBuffer),
        meshGPUCache: new MeshGPUCache(device),
        whiteTexture,
        sampler,
        brdfSampler,
        brdfResources,
        shadowSampler,
        shadowProgram,
        shadowPipeline,
        shadowInputLayout,
        shadowResources,
        textureCache: new Map(),
      };
      resources.add(() => {
        const releases = new ResourceScope();
        for (const entry of state.textureCache.values())
          releases.add(() => entry.texture.destroy());
        // Async image completions must not allocate after the owner is gone.
        state.textureCache.clear();
        releases.dispose();
      });
      // Bindings reference textures and UBOs: release meshes before either.
      own(state.meshGPUCache);
      this.states.set(api, state);
      state.dispose = owner.add(() => {
        if (this.states.get(api) === state) this.states.delete(api);
        resources.dispose();
      });
      return this.states.get(api) === state ? state : null;
    } catch (error) {
      try {
        resources.dispose();
      } catch {
        /* Preserve the allocation error. */
      }
      throw error;
    }
  }

  private resolveEnvironmentBrdf(state: MeshPipeline3DCanvasState): Texture {
    if (state.brdfTexture) return state.brdfTexture;
    const texture = state.device.createTexture({
      format: Format.U8_RGBA_NORM,
      width: ENVIRONMENT_BRDF_SIZE,
      height: ENVIRONMENT_BRDF_SIZE,
      usage: TextureUsage.SAMPLED,
    });
    try {
      texture.setImageData([environmentBrdfPixels()]);
    } catch (error) {
      texture.destroy();
      throw error;
    }
    state.brdfResources.add(() => texture.destroy());
    state.brdfTexture = texture;
    return texture;
  }

  /**
   * Resolve a material texture URL. Returns the device white fallback (and
   * `ready: false`) until the image has loaded.
   */
  private resolveMaterialTexture(
    state: MeshPipeline3DCanvasState,
    device: Device,
    url: string | null,
    environment = false,
  ): { texture: Texture; ready: boolean; irradiance: Float32Array | null } {
    if (!url) {
      return { texture: state.whiteTexture, ready: false, irradiance: null };
    }

    const key = `${environment ? 'environment' : 'material'}:${url}`;
    const cached = state.textureCache.get(key);
    if (cached) {
      return {
        texture:
          cached.status === 'ready' ? cached.texture : state.whiteTexture,
        ready: cached.status === 'ready',
        irradiance: cached.status === 'ready' ? cached.irradiance : null,
      };
    }

    const texture = device.createTexture({
      format: Format.U8_RGBA_NORM,
      width: 1,
      height: 1,
      usage: TextureUsage.SAMPLED,
    });
    texture.setImageData([new Uint8Array([255, 255, 255, 255])]);
    const entry: TextureCacheEntry = {
      texture,
      status: 'loading',
      irradiance: null,
    };
    state.textureCache.set(key, entry);

    void (
      environment && /\.hdr(?:[?#]|$)/i.test(url)
        ? fetch(url)
            .then((response) => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return response.arrayBuffer();
            })
            .then((data) => decodeRadianceHDR(new Uint8Array(data)))
        : loadImageBitmapUniversal(url)
    )
      .then((source) => {
        if (state.textureCache.get(key) !== entry) {
          return;
        }
        let loaded: Texture;
        if (environment) {
          const linear =
            typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap
              ? environmentFromBitmap(source)
              : source;
          const filtered = prefilterEnvironment(linear);
          const canvas = DOMAdapter.get().createCanvas(
            ENV_ATLAS_WIDTH,
            ENV_ATLAS_HEIGHT,
          );
          const context = canvas.getContext('2d') as
            | CanvasRenderingContext2D
            | OffscreenCanvasRenderingContext2D
            | null;
          if (!context)
            throw new Error('A 2D canvas is required for environment maps');
          const image = context.createImageData(
            ENV_ATLAS_WIDTH,
            ENV_ATLAS_HEIGHT,
          );
          image.data.set(filtered.pixels);
          context.putImageData(image, 0, 0);
          loaded = device.createTexture({
            format: Format.U8_RGBA_NORM,
            width: ENV_ATLAS_WIDTH,
            height: ENV_ATLAS_HEIGHT,
            usage: TextureUsage.SAMPLED,
            pixelStore: { unpackFlipY: true },
          });
          try {
            loaded.setImageData([canvas]);
          } catch (error) {
            loaded.destroy();
            throw error;
          }
          entry.irradiance = filtered.irradiance;
        } else {
          const bitmap = source as ImageBitmap;
          loaded = device.createTexture({
            format: Format.U8_RGBA_NORM,
            width: bitmap.width,
            height: bitmap.height,
            usage: TextureUsage.SAMPLED,
            pixelStore: { unpackFlipY: true },
          });
          try {
            loaded.setImageData([bitmap]);
          } catch (error) {
            loaded.destroy();
            throw error;
          }
        }
        entry.texture.destroy();
        entry.texture = loaded;
        entry.status = 'ready';
      })
      .catch((err) => {
        console.warn('[MeshPipeline3D] failed to load material map', url, err);
        entry.status = 'error';
      });

    return { texture: state.whiteTexture, ready: false, irradiance: null };
  }

  execute() {
    syncMeshPipeline3DCanvases(
      this,
      this.canvases.current.map((canvas) => canvas.read(Canvas).api),
    );
    const active = new Map(
      this.canvases.current.map((canvas) => [canvas.read(Canvas).api, canvas]),
    );
    const dirty = this.geometryDirty.addedOrChanged.map(
      (entity) => entity.__id,
    );
    const removed = new Set(this.meshes3D.removed.map((entity) => entity.__id));
    for (const [api, state] of this.states) {
      const canvas = active.get(api);
      if (!canvas || !this.matches(state, canvas)) state.dispose();
      else {
        state.meshGPUCache.retain(
          new Set(
            this.collectMeshEntities(canvas)
              .filter(
                (entity) =>
                  !removed.has(entity.__id) &&
                  entity.read(Mesh3D).positions.length,
              )
              .map((entity) => entity.__id),
          ),
        );
        state.meshGPUCache.invalidate(dirty);
      }
    }

    if (!this.has3DContent()) {
      return;
    }

    for (const canvas of this.canvases.current) {
      this.prepareForComposite(canvas);
    }
  }

  finalize() {
    unregisterMeshPipeline3D(this);
    const releases = new ResourceScope();
    for (const state of this.states.values()) releases.add(state.dispose);
    releases.dispose();
  }
}

export { getMeshPipeline3D };
