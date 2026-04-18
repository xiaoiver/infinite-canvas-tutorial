import type { EventEmitter } from 'eventemitter3';
import { GL } from './constants';
import type { Format } from './format';

export interface DeviceContribution {
  createSwapChain: ($canvas: HTMLCanvasElement) => Promise<SwapChain>;
}

export enum ResourceType {
  Buffer,
  Texture,
  RenderTarget,
  Sampler,
  Program,
  Bindings,
  InputLayout,
  RenderPipeline,
  ComputePipeline,
  Readback,
  QueryPool,
  RenderBundle,
}

export interface Disposable {
  destroy: () => void;
}

export interface ResourceBase extends Disposable, EventEmitter {
  id: number;
  name?: string;
}
export interface Buffer extends ResourceBase {
  type: ResourceType.Buffer;
  setSubData: (
    dstByteOffset: number,
    src: Uint8Array,
    srcByteOffset?: number,
    byteLength?: number,
  ) => void;
}
export interface Texture extends ResourceBase {
  type: ResourceType.Texture;
  setImageData: (
    data: (TexImageSource | ArrayBufferView)[],
    lod?: number,
  ) => void;
}
export interface RenderTarget extends ResourceBase {
  type: ResourceType.RenderTarget;
}
export interface Sampler extends ResourceBase {
  type: ResourceType.Sampler;
}
export interface Program extends ResourceBase {
  type: ResourceType.Program;
  // eslint-disable-next-line
  setUniformsLegacy: (uniforms: Record<string, any>) => void;
}
export interface Bindings extends ResourceBase {
  type: ResourceType.Bindings;
}
export interface InputLayout extends ResourceBase {
  type: ResourceType.InputLayout;
}
export interface RenderPipeline extends ResourceBase {
  type: ResourceType.RenderPipeline;
}
export interface RenderBundle extends ResourceBase {
  type: ResourceType.RenderBundle;
}
export interface QueryPool extends ResourceBase {
  type: ResourceType.QueryPool;

  queryResultOcclusion: (dstOffs: number) => boolean | null;
}
export interface Readback extends ResourceBase {
  type: ResourceType.Readback;

  readTexture: (
    t: Texture,
    x: number,
    y: number,
    width: number,
    height: number,
    dst: ArrayBufferView,
    dstOffset?: number,
    length?: number,
  ) => Promise<ArrayBufferView>;

  readTextureSync: (
    t: Texture,
    x: number,
    y: number,
    width: number,
    height: number,
    dst: ArrayBufferView,
    dstOffset?: number,
    length?: number,
  ) => ArrayBufferView;

  readBuffer: (
    b: Buffer,
    srcByteOffset: number,
    dst: ArrayBufferView,
    dstOffset?: number,
    length?: number,
  ) => Promise<ArrayBufferView>;
}
export interface ComputePipeline extends ResourceBase {
  type: ResourceType.ComputePipeline;
}

export type Resource =
  | Buffer
  | Texture
  | RenderTarget
  | Sampler
  | Program
  | Bindings
  | InputLayout
  | RenderPipeline
  | ComputePipeline
  | Readback;

export enum CompareFunction {
  NEVER = GL.NEVER,
  LESS = GL.LESS,
  EQUAL = GL.EQUAL,
  LEQUAL = GL.LEQUAL,
  GREATER = GL.GREATER,
  NOTEQUAL = GL.NOTEQUAL,
  GEQUAL = GL.GEQUAL,
  ALWAYS = GL.ALWAYS,
}

export enum FrontFace {
  CCW = GL.CCW,
  CW = GL.CW,
}

export enum CullMode {
  NONE,
  FRONT,
  BACK,
  FRONT_AND_BACK,
}

/**
 * Blend factor RGBA components.
 * @see https://www.w3.org/TR/webgpu/#enumdef-gpublendfactor
 */
export enum BlendFactor {
  /**
   * (0, 0, 0, 0)
   */
  ZERO = GL.ZERO,
  /**
   * (1, 1, 1, 1)
   */
  ONE = GL.ONE,
  /**
   * (Rsrc, Gsrc, Bsrc, Asrc)
   */
  SRC = GL.SRC_COLOR,
  /**
   * (1 - Rsrc, 1 - Gsrc, 1 - Bsrc, 1 - Asrc)
   */
  ONE_MINUS_SRC = GL.ONE_MINUS_SRC_COLOR,
  /**
   * (Rdst, Gdst, Bdst, Adst)
   */
  DST = GL.DST_COLOR,
  /**
   * (1 - Rdst, 1 - Gdst, 1 - Bdst, 1 - Adst)
   */
  ONE_MINUS_DST = GL.ONE_MINUS_DST_COLOR,
  /**
   * (Asrc, Asrc, Asrc, Asrc)
   */
  SRC_ALPHA = GL.SRC_ALPHA,
  /**
   * (1 - Asrc, 1 - Asrc, 1 - Asrc, 1 - Asrc)
   */
  ONE_MINUS_SRC_ALPHA = GL.ONE_MINUS_SRC_ALPHA,
  /**
   * (Adst, Adst, Adst, Adst)
   */
  DST_ALPHA = GL.DST_ALPHA,
  /**
   * (1 - Adst, 1 - Adst, 1 - Adst, 1 - Adst)
   */
  ONE_MINUS_DST_ALPHA = GL.ONE_MINUS_DST_ALPHA,
  /**
   * (Rconst, Gconst, Bconst, Aconst)
   */
  CONST = GL.CONSTANT_COLOR,
  /**
   * (1 - Rconst, 1 - Gconst, 1 - Bconst, 1 - Aconst)
   */
  ONE_MINUS_CONSTANT = GL.ONE_MINUS_CONSTANT_COLOR,
  /**
   * (min(Asrc, 1 - Adst), min(Asrc, 1 - Adst), min(Asrc, 1 - Adst), 1)
   */
  SRC_ALPHA_SATURATE = GL.SRC_ALPHA_SATURATE,
}

/**
 * Defines the algorithm used to combine source and destination blend factors.
 * @see https://www.w3.org/TR/webgpu/#enumdef-gpublendoperation
 */
export enum BlendMode {
  /**
   * RGBAsrc × RGBAsrcFactor + RGBAdst × RGBAdstFactor
   */
  ADD = GL.FUNC_ADD,
  /**
   * RGBAsrc × RGBAsrcFactor - RGBAdst × RGBAdstFactor
   */
  SUBSTRACT = GL.FUNC_SUBTRACT,
  /**
   * RGBAdst × RGBAdstFactor - RGBAsrc × RGBAsrcFactor
   */
  REVERSE_SUBSTRACT = GL.FUNC_REVERSE_SUBTRACT,
  // TODO: WebGL 1 should use ext
  // @see https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/blendEquation#parameters
  /**
   * min(RGBAsrc, RGBAdst)
   */
  MIN = GL.MIN,
  /**
   * max(RGBAsrc, RGBAdst)
   */
  MAX = GL.MAX,
}

export enum AddressMode {
  CLAMP_TO_EDGE,
  REPEAT,
  MIRRORED_REPEAT,
}
export enum FilterMode {
  POINT,
  BILINEAR,
}
export enum MipmapFilterMode {
  NO_MIP,
  NEAREST,
  LINEAR,
}
export enum PrimitiveTopology {
  POINTS,
  TRIANGLES,
  TRIANGLE_STRIP,
  LINES,
  LINE_STRIP,
}

/**
 * @see https://www.w3.org/TR/webgpu/#GPUBufferDescriptor
 */
export interface BufferDescriptor {
  viewOrSize: ArrayBufferView | number;
  usage: BufferUsage;
  hint?: BufferFrequencyHint;
}

/**
 * @see https://www.w3.org/TR/webgpu/#buffer-usage
 */
export enum BufferUsage {
  MAP_READ = 0x0001,
  MAP_WRITE = 0x0002,
  COPY_SRC = 0x0004,
  COPY_DST = 0x0008,
  INDEX = 0x0010,
  VERTEX = 0x0020,
  UNIFORM = 0x0040,
  STORAGE = 0x0080,
  INDIRECT = 0x0100,
  QUERY_RESOLVE = 0x0200,
}

export enum BufferFrequencyHint {
  STATIC = 0x01,
  DYNAMIC = 0x02,
}

/**
 * @see https://www.w3.org/TR/webgpu/#enumdef-gpuvertexstepmode
 */
export enum VertexStepMode {
  VERTEX = 0x01,
  INSTANCE = 0x02,
}

export enum TextureEvent {
  LOADED = 'loaded',
}

export enum TextureDimension {
  TEXTURE_2D,
  TEXTURE_2D_ARRAY,
  TEXTURE_3D,
  TEXTURE_CUBE_MAP,
}

export enum TextureUsage {
  SAMPLED = 0x01,
  RENDER_TARGET = 0x02,
  STORAGE = 0x04,
}

export enum ChannelWriteMask {
  NONE = 0x00,
  RED = 0x01,
  GREEN = 0x02,
  BLUE = 0x04,
  ALPHA = 0x08,
  RGB = 0x07,
  ALL = 0x0f,
}

/**
 * @see https://www.w3.org/TR/webgpu/#enumdef-gpustenciloperation
 */
export enum StencilOp {
  KEEP = GL.KEEP,
  ZERO = GL.ZERO,
  REPLACE = GL.REPLACE,
  INVERT = GL.INVERT,
  INCREMENT_CLAMP = GL.INCR,
  DECREMENT_CLAMP = GL.DECR,
  INCREMENT_WRAP = GL.INCR_WRAP,
  DECREMENT_WRAP = GL.DECR_WRAP,
}

export interface VertexBufferDescriptor {
  buffer: Buffer;
  offset?: number;
}

export type IndexBufferDescriptor = VertexBufferDescriptor;

export interface VertexAttributeDescriptor {
  /**
   * The numeric location associated with this attribute,
   * which will correspond with a "@location" attribute declared in the vertex.module.
   * @see https://www.w3.org/TR/webgpu/#dom-gpuvertexattribute-shaderlocation
   */
  shaderLocation: number;
  /**
   * The GPUVertexFormat of the attribute.
   * @see https://www.w3.org/TR/webgpu/#dom-gpuvertexattribute-format
   */
  format: Format;
  /**
   * The offset, in bytes, from the beginning of the element to the data for the attribute.
   * @see https://www.w3.org/TR/webgpu/#dom-gpuvertexattribute-offset
   */
  offset: number;
  divisor?: number;
}

export interface InputLayoutBufferDescriptor {
  /**
   * The stride, in bytes, between elements of this array.
   * @see https://www.w3.org/TR/webgpu/#dom-gpuvertexbufferlayout-arraystride
   */
  arrayStride: number;
  /**
   * Whether each element of this array represents per-vertex data or per-instance data.
   * @see https://www.w3.org/TR/webgpu/#dom-gpuvertexbufferlayout-stepmode
   */
  stepMode: VertexStepMode;
  /**
   * An array defining the layout of the vertex attributes within each element.
   * @see https://www.w3.org/TR/webgpu/#dom-gpuvertexbufferlayout-attributes
   */
  attributes: VertexAttributeDescriptor[];
}

export interface TextureDescriptor {
  dimension?: TextureDimension;
  format: Format;
  width: number;
  height: number;
  depthOrArrayLayers?: number;
  mipLevelCount?: number;
  usage: TextureUsage;
  /**
   * @see https://developer.mozilla.org/zh-CN/docs/Web/API/WebGLRenderingContext/pixelStorei
   */
  pixelStore?: Partial<{
    packAlignment: number;
    unpackAlignment: number;
    unpackFlipY: boolean;
  }>;
}

export function makeTextureDescriptor2D(
  format: Format,
  width: number,
  height: number,
  mipLevelCount: number,
): TextureDescriptor {
  const dimension = TextureDimension.TEXTURE_2D;
  const depthOrArrayLayers = 1;
  const usage = TextureUsage.SAMPLED;
  return {
    dimension,
    format,
    width,
    height,
    depthOrArrayLayers,
    mipLevelCount,
    usage,
  };
}

export interface SamplerDescriptor {
  addressModeU: AddressMode;
  addressModeV: AddressMode;
  addressModeW?: AddressMode;
  minFilter: FilterMode;
  magFilter: FilterMode;
  mipmapFilter: MipmapFilterMode;
  lodMinClamp?: number;
  lodMaxClamp?: number;
  maxAnisotropy?: number;
  compareFunction?: CompareFunction;
}

export interface RenderTargetDescriptor {
  format: Format;
  width: number;
  height: number;
  sampleCount?: number;
  texture?: Texture;
}

export interface TextureBinding {
  binding?: number;
  texture: Texture;
}

/**
 * @see https://www.w3.org/TR/webgpu/#dictdef-gpubindgroupentry
 */
export interface BufferBinding {
  /**
   * @see https://www.w3.org/TR/webgpu/#dom-gpubindgroupentry-binding
   * @example
   * @binding(0) @group(0) var<uniform> params : SimParams;
   */
  binding?: number;
  /**
   * @{Buffer}
   */
  buffer: Buffer;
  /**
   * The offset, in bytes, from the beginning of buffer to the beginning of the range exposed to the shader by the buffer binding.
   * Defaulting to 0
   * @see https://www.w3.org/TR/webgpu/#dom-gpubufferbinding-offset
   */
  offset?: number;
  /**
   * The size, in bytes, of the buffer binding. If not provided, specifies the range starting at offset and ending at the end of buffer.
   * @see https://www.w3.org/TR/webgpu/#dom-gpubufferbinding-size
   */
  size?: number;
}

export interface SamplerBinding {
  texture: Texture | null;
  sampler: Sampler | null;
  dimension?: TextureDimension;
  formatKind?: SamplerFormatKind;
  comparison?: boolean;
  textureBinding?: number;
  samplerBinding?: number;
}

export enum SamplerFormatKind {
  Float,
  UnfilterableFloat,
  Uint,
  Sint,
  Depth,
}

export interface BindingsDescriptor {
  // infer from shader module @see https://www.w3.org/TR/webgpu/#dom-gpupipelinebase-getbindgrouplayout
  pipeline?: RenderPipeline | ComputePipeline;
  uniformBufferBindings?: BufferBinding[];
  samplerBindings?: SamplerBinding[];
  storageBufferBindings?: BufferBinding[];
  storageTextureBindings?: TextureBinding[];
}

export interface WGSLShaderStageDescriptor {
  /**
   * @see https://www.w3.org/TR/WGSL
   */
  wgsl?: string;
  /**
   * Entry point is intended to be used in the future.
   * @see https://www.w3.org/TR/webgpu/#dom-gpushadermodulecompilationhint-entrypoint
   */
  entryPoint?: string;
  /**
   * Modify the code after compilation.
   */
  postprocess?: (code: string) => string;
}

export type GLSLAndWGSLShaderStageDescriptor = {
  glsl?: string;
} & WGSLShaderStageDescriptor;

/**
 * Support the following shaderStage: vertex | fragment | compute.
 */
export interface ProgramDescriptor {
  vertex?: GLSLAndWGSLShaderStageDescriptor;
  fragment?: GLSLAndWGSLShaderStageDescriptor;
  compute?: WGSLShaderStageDescriptor;
}

export interface ProgramDescriptorSimple {
  vert?: string;
  frag?: string;
  preprocessedVert?: string;
  preprocessedFrag?: string;
  preprocessedCompute?: string;
}

export interface InputLayoutDescriptor {
  vertexBufferDescriptors: (InputLayoutBufferDescriptor | null)[];
  indexBufferFormat: Format | null;
  /**
   * Read attributes from linked program.
   */
  program: Program;
}

export interface ChannelBlendState {
  blendMode: BlendMode;
  blendSrcFactor: BlendFactor;
  blendDstFactor: BlendFactor;
}

export interface AttachmentState {
  channelWriteMask?: ChannelWriteMask;
  rgbBlendState: ChannelBlendState;
  alphaBlendState: ChannelBlendState;
}

export interface StencilFaceState {
  failOp: StencilOp;
  passOp: StencilOp;
  depthFailOp: StencilOp;
  compare?: CompareFunction;
  mask?: number;
}

export interface MegaStateDescriptor {
  attachmentsState: AttachmentState[];
  blendConstant?: Color;
  depthCompare?: CompareFunction;
  depthWrite?: boolean;
  stencilFront?: Partial<StencilFaceState>;
  stencilBack?: Partial<StencilFaceState>;
  stencilWrite?: boolean;
  // stencilWriteMask?: number;
  // stencilReadMask?: number;
  cullMode?: CullMode;
  frontFace?: FrontFace;
  polygonOffset?: boolean;
  polygonOffsetFactor?: number;
  polygonOffsetUnits?: number;
}

export interface PipelineDescriptor {
  inputLayout: InputLayout | null;
  program: Program;
}

export interface RenderPipelineDescriptor extends PipelineDescriptor {
  topology?: PrimitiveTopology;
  megaStateDescriptor?: MegaStateDescriptor;

  // Attachment data.
  colorAttachmentFormats: (Format | null)[];
  depthStencilAttachmentFormat?: Format | null;
  sampleCount?: number;
}

export type ComputePipelineDescriptor = PipelineDescriptor;

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface RenderPassDescriptor {
  colorAttachment: (RenderTarget | null)[];
  colorAttachmentLevel?: number[];
  colorClearColor?: (Color | 'load')[];
  colorResolveTo: (Texture | null)[];
  colorResolveToLevel?: number[];
  colorStore?: boolean[];
  depthStencilAttachment?: RenderTarget | null;
  depthStencilResolveTo?: Texture | null;
  depthStencilStore?: boolean;
  depthClearValue?: number | 'load';
  stencilClearValue?: number | 'load';
  occlusionQueryPool?: QueryPool | null;
  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/GPURenderBundle
   */
  renderBundle?: boolean;
}

export interface DeviceLimits {
  uniformBufferWordAlignment: number;
  uniformBufferMaxPageWordSize: number;
  readonly supportedSampleCounts: number[];
  occlusionQueriesRecommended: boolean;
  computeShadersSupported: boolean;
}

export interface DebugGroup {
  name: string;
  drawCallCount: number;
  textureBindCount: number;
  bufferUploadCount: number;
  triangleCount: number;
}

export enum ViewportOrigin {
  LOWER_LEFT,
  UPPER_LEFT,
}

export enum ClipSpaceNearZ {
  NEGATIVE_ONE,
  ZERO,
}

export interface VendorInfo {
  readonly platformString: string;
  readonly glslVersion: string;
  readonly explicitBindingLocations: boolean;
  readonly separateSamplerTextures: boolean;
  readonly viewportOrigin: ViewportOrigin;
  readonly clipSpaceNearZ: ClipSpaceNearZ;
  readonly supportMRT: boolean;
}

export type PlatformFramebuffer = WebGLFramebuffer;

export interface SwapChain {
  // @see https://www.w3.org/TR/webgpu/#canvas-configuration
  configureSwapChain: (
    width: number,
    height: number,
    platformFramebuffer?: PlatformFramebuffer,
  ) => void;
  getDevice: () => Device;
  getCanvas: () => HTMLCanvasElement | OffscreenCanvas;
  getOnscreenTexture: () => Texture;
}

/**
 * @see https://www.w3.org/TR/webgpu/#debug-markers
 */
interface DebugCommandsMixin {
  pushDebugGroup: (groupLabel: string) => void;
  popDebugGroup: () => void;
  insertDebugMarker: (markerLabel: string) => void;
}

export interface RenderPass extends DebugCommandsMixin {
  // State management.
  setViewport: (
    x: number,
    y: number,
    w: number,
    h: number,
    /**
     * WebGPU only.
     */
    minDepth?: number,
    /**
     * WebGPU only.
     */
    maxDepth?: number,
  ) => void;
  setScissorRect: (x: number, y: number, w: number, h: number) => void;
  setPipeline: (pipeline: RenderPipeline) => void;
  setBindings: (bindings: Bindings) => void;
  setVertexInput: (
    inputLayout: InputLayout | null,
    buffers: (VertexBufferDescriptor | null)[] | null,
    indexBuffer: IndexBufferDescriptor | null,
  ) => void;
  /**
   * Sets the [[stencilReference]] value used during stencil tests with the "replace" GPUStencilOperation.
   * @see https://www.w3.org/TR/webgpu/#dom-gpurenderpassencoder-setstencilreference
   */
  setStencilReference: (value: number) => void;

  // Draw commands.
  /**
   * @see https://www.w3.org/TR/webgpu/#dom-gpurendercommandsmixin-draw
   */
  draw: (
    vertexCount: number,
    instanceCount?: number,
    firstVertex?: number,
    firstInstance?: number,
  ) => void;
  /**
   * @see https://www.w3.org/TR/webgpu/#dom-gpurendercommandsmixin-drawindexed
   */
  drawIndexed: (
    indexCount: number,
    instanceCount?: number,
    firstIndex?: number,
    baseVertex?: number,
    firstInstance?: number,
  ) => void;
  /**
   * WebGPU only.
   * Draws indexed primitives using parameters read from a GPUBuffer.
   * @see https://www.w3.org/TR/webgpu/#dom-gpurendercommandsmixin-drawindexedindirect
   */
  drawIndexedIndirect: (indirectBuffer: Buffer, indirectOffset: number) => void;
  /**
   * WebGPU only.
   * @see https://www.w3.org/TR/webgpu/#dom-gpurendercommandsmixin-drawindirect
   */
  drawIndirect: (indirectBuffer: Buffer, indirectOffset: number) => void;

  // Query system.
  beginOcclusionQuery: (queryIndex: number) => void;
  endOcclusionQuery: () => void;

  // Render bundle
  beginBundle: (renderBundle: RenderBundle) => void;
  endBundle: () => void;
  executeBundles: (renderBundles: RenderBundle[]) => void;
}

/**
 * @see https://www.w3.org/TR/webgpu/#compute-passes
 */
export interface ComputePass extends DebugCommandsMixin {
  setPipeline: (pipeline: ComputePipeline) => void;
  setBindings: (bindings: Bindings) => void;
  /**
   * @see https://www.w3.org/TR/webgpu/#dom-gpucomputepassencoder-dispatchworkgroups
   */
  dispatchWorkgroups: (
    workgroupCountX: number,
    workgroupCountY?: number,
    workgroupCountZ?: number,
  ) => void;
  /**
   * @see https://www.w3.org/TR/webgpu/#dom-gpucomputepassencoder-dispatchworkgroupsindirect
   */
  dispatchWorkgroupsIndirect: (
    indirectBuffer: Buffer,
    indirectOffset: number,
  ) => void;
}

export enum QueryPoolType {
  OcclusionConservative,
}
/**
 * Device represents a "virtual GPU"
 * @see https://www.w3.org/TR/webgpu/#gpu-device
 *
 * Support following backends:
 * * webgl1 CanvasWebGLRenderingContext
 * * WebGL2 CanvasWebGL2RenderingContext
 * * WebGPU GPUDevice
 *
 * A bit about the design of this API; all resources are "opaque", meaning you cannot look at the
 * implementation details or underlying fields of the resources, and most objects cannot have their
 * creation parameters modified after they are created. So, while buffers and textures can have their
 * contents changed through data upload passes, they cannot be resized after creation. Create a new object
 * and destroy the old one if you wish to "resize" it.
 */
export interface Device {
  /**
   * @see https://www.w3.org/TR/webgpu/#dom-gpudevice-createbuffer
   */
  createBuffer: (descriptor: BufferDescriptor) => Buffer;
  createTexture: (descriptor: TextureDescriptor) => Texture;
  createSampler: (descriptor: SamplerDescriptor) => Sampler;
  createRenderTarget: (descriptor: RenderTargetDescriptor) => RenderTarget;
  createRenderTargetFromTexture: (texture: Texture) => RenderTarget;
  createProgram: (program: ProgramDescriptor) => Program;
  createBindings: (bindingsDescriptor: BindingsDescriptor) => Bindings;
  createInputLayout: (
    inputLayoutDescriptor: InputLayoutDescriptor,
  ) => InputLayout;
  createRenderPipeline: (
    descriptor: RenderPipelineDescriptor,
  ) => RenderPipeline;
  createComputePipeline: (
    descriptor: ComputePipelineDescriptor,
  ) => ComputePipeline;
  createReadback: () => Readback;
  createQueryPool: (type: QueryPoolType, elemCount: number) => QueryPool;

  createRenderPass: (renderPassDescriptor: RenderPassDescriptor) => RenderPass;
  createComputePass: () => ComputePass;
  createRenderBundle: () => RenderBundle;

  beginFrame(): void;
  endFrame(): void;
  submitPass: (pass: RenderPass | ComputePass) => void;
  destroy(): void;

  // Render pipeline compilation control.
  pipelineQueryReady: (o: RenderPipeline) => boolean;
  pipelineForceReady: (o: RenderPipeline) => void;

  copySubTexture2D: (
    dst: Texture,
    dstX: number,
    dstY: number,
    src: Texture,
    srcX: number,
    srcY: number,
    depthOrArrayLayers?: number,
  ) => void;

  // Information queries.
  queryLimits: () => DeviceLimits;
  queryTextureFormatSupported: (
    format: Format,
    width: number,
    height: number,
  ) => boolean;
  queryPlatformAvailable: () => boolean;
  queryVendorInfo: () => VendorInfo;
  queryRenderPass: (o: RenderPass) => Readonly<RenderPassDescriptor>;
  queryRenderTarget: (o: RenderTarget) => Readonly<RenderTargetDescriptor>;

  // Debugging.
  setResourceName: (o: Resource, s: string) => void;
  setResourceLeakCheck: (o: Resource, v: boolean) => void;
  checkForLeaks: () => void;
  programPatched: (o: Program, descriptor: ProgramDescriptor) => void;
}
