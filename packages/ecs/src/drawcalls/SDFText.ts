import {
  type RenderPass,
  Buffer,
  BufferFrequencyHint,
  BufferUsage,
  BlendMode,
  BlendFactor,
  ChannelWriteMask,
  Format,
  VertexStepMode,
  CompareFunction,
  BindingsDescriptor,
  AddressMode,
  FilterMode,
  MipmapFilterMode,
  TransparentBlack,
  Texture,
  StencilOp,
  type Program,
  type RenderPipeline,
  type InputLayout,
  type Bindings,
  TextureUsage,
} from '@infinite-canvas-tutorial/device-api';
import { Entity } from '@lastolivegames/becsy';
import { mat3 } from 'gl-matrix';
import { Drawcall, ZINDEX_FACTOR, STENCIL_CLIP_REF } from './Drawcall';
import { vert, frag, physical_frag, Location } from '../shaders/sdf_text';
import {
  BASE_FONT_WIDTH,
  GlyphManager,
  paddingMat3,
  getGlyphQuads,
  SDF_SCALE,
  BitmapFont,
  GlyphPositions,
  containsEmoji,
  parseColor,
} from '../utils';
import {
  ComputedBounds,
  ComputedTextMetrics,
  DropShadow,
  FillSolid,
  GlobalRenderOrder,
  GlobalTransform,
  Mat3,
  Opacity,
  SizeAttenuation,
  Stroke,
  Text,
} from '../components';
import {
  getRasterFilterValueForShape,
  parseEffect,
  filterRasterPostEffects,
  filterStringUsesEngineTimePost,
} from '../utils/filter';
import {
  getDevicePixelRatioForRaster,
  resolveFillImageTexturePixelSize,
} from '../utils/fillImageTextureSize';

export class SDFText extends Drawcall {
  #glyphManager = new GlyphManager();
  #uniformBuffer: Buffer;
  /** Display texture: glyph atlas, or filtered raster when {@link Drawcall.useFillImage}. */
  #texture: Texture | null = null;
  /** Unfiltered RGBA from GPU SDF bake (post chain input). */
  #rawFillImageTexture: Texture | null = null;
  /** True when {@link #texture} is owned by {@link destroyFullPostProcessingChain}. */
  #fillTextureFromPostChain = false;

  #bakeProgram: Program | null = null;
  #bakePipeline: RenderPipeline | null = null;
  #bakeInputLayout: InputLayout | null = null;
  #bakeBindings: Bindings | null = null;
  #bakeSceneUniformBuffer: Buffer | null = null;

  validate(shape: Entity) {
    const result = super.validate(shape);
    if (!result) {
      return false;
    }

    if (this.shapes.length === 0) {
      return true;
    }

    if (this.hash(this.shapes[0]) !== this.hash(shape)) {
      return false;
    }

    return true;
  }

  private hash(shape: Entity) {
    const { bitmapFont, physical } = shape.read(Text);
    const { value: fill } = shape.has(FillSolid)
      ? shape.read(FillSolid)
      : { value: 'none' };
    const { color: stroke } = shape.has(Stroke)
      ? shape.read(Stroke)
      : { color: 'none' };

    const font = shape.has(ComputedTextMetrics)
      ? shape.read(ComputedTextMetrics)
      : '';
    const blurRadius = shape.has(DropShadow)
      ? shape.read(DropShadow).blurRadius
      : 0;
    const fv = getRasterFilterValueForShape(shape) ?? '';
    return `${font}-${bitmapFont?.fontFamily}-${physical}-${blurRadius}-${fill}-${stroke}-${fv}`;
  }

  protected override get useRasterFilterEngineTimeRefresh(): boolean {
    const s = this.shapes[0];
    if (!s) {
      return false;
    }
    if (!this.useFillImage) {
      return false;
    }
    const fv = getRasterFilterValueForShape(s);
    return !!(fv && filterStringUsesEngineTimePost(fv));
  }

  private get useBitmapFont() {
    return !!this.shapes[0].read(Text).bitmapFont;
  }

  createGeometry(): void {
    const {
      fontFamily,
      fontWeight,
      fontStyle,
      bitmapFont,
      esdt,
      // content,
      fontSize,
    } = this.shapes[0].read(Text);
    const { font, fontMetrics } = this.shapes[0].read(ComputedTextMetrics);
    const { value: fill } = this.shapes[0].has(FillSolid)
      ? this.shapes[0].read(FillSolid)
      : { value: 'black' };

    // const hasEmoji = containsEmoji(content);
    const hasEmoji = true;

    const indices: number[] = [];
    const positions: number[] = [];
    const uvOffsets: number[] = [];
    let indicesOff = 0;
    let fontScale: number;

    if (this.useBitmapFont) {
      fontScale = fontMetrics.fontSize / bitmapFont.baseMeasurementFontSize;
    } else {
      // scale current font size to base(24)
      fontScale = Number(fontSize) / (BASE_FONT_WIDTH / SDF_SCALE);
      const allText = this.shapes
        .map((text: Entity) => text.read(ComputedTextMetrics).bidiChars)
        .join('');
      this.#glyphManager.generateAtlas(
        font,
        fontFamily,
        fontWeight.toString(),
        fontStyle,
        allText,
        this.device,
        esdt,
        hasEmoji ? (fill as string) : '',
      );
    }

    this.shapes.forEach((object: Entity) => {
      const metrics = object.read(ComputedTextMetrics);
      const { letterSpacing, bitmapFont } = object.read(Text);
      const { font, lines, lineHeight } = metrics;

      const {
        indicesOffset,
        indexBuffer,
        charUVOffsetBuffer,
        charPositionsBuffer,
      } = this.buildTextBuffers({
        object,
        lines,
        fontStack: font,
        lineHeight,
        letterSpacing: letterSpacing,
        indicesOffset: indicesOff,
        bitmapFont,
        fontScale,
      });
      indicesOff = indicesOffset;

      uvOffsets.push(...charUVOffsetBuffer);
      positions.push(...charPositionsBuffer);
      indices.push(...indexBuffer);
    });

    this.indexBufferData = new Uint32Array(indices);

    if (this.vertexBuffers[0]) {
      this.vertexBuffers[0].destroy();
    }
    this.vertexBufferDatas[0] = new Float32Array(positions);
    this.vertexBuffers[0] = this.device.createBuffer({
      viewOrSize: this.vertexBufferDatas[0],
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });

    if (this.vertexBuffers[1]) {
      this.vertexBuffers[1].destroy();
    }
    this.vertexBufferDatas[1] = new Float32Array(uvOffsets);
    this.vertexBuffers[1] = this.device.createBuffer({
      viewOrSize: this.vertexBufferDatas[1],
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });

    if (this.indexBuffer) {
      this.indexBuffer.destroy();
    }
    this.indexBuffer = this.device.createBuffer({
      viewOrSize: this.indexBufferData,
      usage: BufferUsage.INDEX,
      hint: BufferFrequencyHint.STATIC,
    });

    this.vertexBufferDescriptors = [
      {
        arrayStride: 4 * 3,
        stepMode: VertexStepMode.VERTEX,
        attributes: [
          {
            shaderLocation: Location.POSITION, // a_Position
            offset: 0,
            format: Format.F32_RGB,
          },
        ],
      },
      {
        arrayStride: 4 * 4,
        stepMode: VertexStepMode.VERTEX,
        attributes: [
          {
            shaderLocation: Location.UV_OFFSET, // a_UvOffset
            offset: 0,
            format: Format.F32_RGBA,
          },
        ],
      },
    ];
  }

  createMaterial(defines: string, uniformBuffer: Buffer): void {
    const shape = this.shapes[0];
    const { content, physical } = shape.read(Text);
    const { blurRadius } = shape.has(DropShadow)
      ? shape.read(DropShadow)
      : { blurRadius: 0 };

    let glyphAtlasTexture: Texture;
    if (this.useBitmapFont) {
      const { bitmapFont } = shape.read(Text);
      bitmapFont.createTexture(this.device);
      glyphAtlasTexture = bitmapFont.pages[0].texture;

      const { distanceField } = bitmapFont;
      if (distanceField.type === 'msdf') {
        defines += '#define USE_MSDF\n';
      } else if (distanceField.type === 'sdf') {
        defines += '#define USE_SDF\n';
      } else {
        defines += '#define USE_SDF_NONE\n';
      }
    } else {
      defines += '#define USE_SDF\n';
      const hasEmoji = containsEmoji(content);
      if (hasEmoji) {
        defines += '#define USE_EMOJI\n';
      }

      glyphAtlasTexture = this.#glyphManager.getAtlasTexture();
    }

    if (blurRadius > 0) {
      defines += '#define USE_SHADOW\n';
    }

    this.device.setResourceName(glyphAtlasTexture, 'SDFText Texture');

    const useFillImage = defines.includes('USE_FILLIMAGE');
    this.destroyFullPostProcessingChain();
    this.#teardownFillImageGpu();
    if (!useFillImage) {
      this.#bakeBindings?.destroy();
      this.#bakeBindings = null;
    }

    const definesBake = defines
      .replace('#define USE_FILLIMAGE\n', '')
      .replace('#define USE_WIREFRAME\n', '')
      .replace('#define USE_STENCIL\n', '');

    const isWebGPU = this.device.queryVendorInfo().platformString === 'WebGPU';
    const diagnosticDerivativeUniformityHeader = isWebGPU
      ? 'diagnostic(off,derivative_uniformity);\n'
      : '';

    if (useFillImage) {
      const rb = shape.read(ComputedBounds).renderBounds;
      const gw = rb.maxX - rb.minX;
      const gh = rb.maxY - rb.minY;
      const { width: tw, height: th } = resolveFillImageTexturePixelSize(
        1,
        1,
        gw,
        gh,
        getDevicePixelRatioForRaster(),
      );

      this.#bakeProgram = this.renderCache.createProgram({
        vertex: { glsl: definesBake + vert },
        fragment: {
          glsl: definesBake + (physical ? physical_frag : frag),
          postprocess: (fs) => diagnosticDerivativeUniformityHeader + fs,
        },
      });
      this.#bakeInputLayout = this.renderCache.createInputLayout({
        vertexBufferDescriptors: this.vertexBufferDescriptors,
        indexBufferFormat: Format.U32_R,
        program: this.#bakeProgram,
      });
      this.#bakePipeline = this.renderCache.createRenderPipeline({
        inputLayout: this.#bakeInputLayout,
        program: this.#bakeProgram,
        colorAttachmentFormats: [Format.U8_RGBA_RT],
        depthStencilAttachmentFormat: Format.D24_S8,
        megaStateDescriptor: {
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
          depthWrite: true,
          depthCompare: CompareFunction.GREATER,
          stencilWrite: false,
          stencilFront: {
            compare: CompareFunction.ALWAYS,
            passOp: StencilOp.KEEP,
            failOp: StencilOp.KEEP,
            depthFailOp: StencilOp.KEEP,
          },
          stencilBack: {
            compare: CompareFunction.ALWAYS,
            passOp: StencilOp.KEEP,
            failOp: StencilOp.KEEP,
            depthFailOp: StencilOp.KEEP,
          },
        },
      });
      this.device.setResourceName(this.#bakePipeline, 'SDFTextBakePipeline');

      if (!this.#bakeSceneUniformBuffer) {
        this.#bakeSceneUniformBuffer = this.device.createBuffer({
          viewOrSize: 48 * Float32Array.BYTES_PER_ELEMENT,
          usage: BufferUsage.UNIFORM,
          hint: BufferFrequencyHint.DYNAMIC,
        });
      }
      // Projection must use logical bounds (gw×gh): vertices live in layout space, while
      // tw×th is only the RT pixel resolution (DPR). projection(tw,th) shrinks content to
      // ~1/dpr² of the texture (e.g. 1/4 at devicePixelRatio=2).
      this.#writeBakeSceneUniforms(gw, gh, tw, th);

      if (!this.#uniformBuffer) {
        this.#uniformBuffer = this.device.createBuffer({
          viewOrSize: Float32Array.BYTES_PER_ELEMENT * 60,
          usage: BufferUsage.UNIFORM,
          hint: BufferFrequencyHint.DYNAMIC,
        });
      }

      const translate = mat3.create();
      mat3.identity(translate);
      mat3.translate(translate, translate, [-rb.minX, -rb.minY]);
      const bakeModel = Mat3.fromGLMat3(translate);
      const atlasImage = this.useBitmapFont
        ? shape.read(Text).bitmapFont.pages[0]
        : this.#glyphManager.getAtlas().image;
      const [bakeBuf, bakeLegacy] = this.generateBuffer(shape, atlasImage);
      this.#uniformBuffer.setSubData(
        0,
        new Uint8Array(
          new Float32Array([
            ...paddingMat3(bakeModel),
            ...bakeBuf,
          ]).buffer,
        ),
      );
      this.#bakeProgram.setUniformsLegacy({
        u_ModelMatrix: Mat3.toGLMat3(bakeModel),
        ...bakeLegacy,
      });

      const bakeSampler = this.renderCache.createSampler({
        addressModeU: AddressMode.CLAMP_TO_EDGE,
        addressModeV: AddressMode.CLAMP_TO_EDGE,
        minFilter: FilterMode.POINT,
        magFilter: FilterMode.BILINEAR,
        mipmapFilter: MipmapFilterMode.LINEAR,
        lodMinClamp: 0,
        lodMaxClamp: 0,
      });

      this.#bakeBindings?.destroy();
      this.#bakeBindings = this.renderCache.createBindings({
        pipeline: this.#bakePipeline,
        uniformBufferBindings: [
          { buffer: this.#bakeSceneUniformBuffer },
          { buffer: this.#uniformBuffer },
        ],
        samplerBindings: [
          {
            texture: glyphAtlasTexture,
            sampler: bakeSampler,
          },
        ],
      });

      const colorTex = this.device.createTexture({
        format: Format.U8_RGBA_NORM,
        width: tw,
        height: th,
        usage: TextureUsage.RENDER_TARGET | TextureUsage.SAMPLED,
      });
      const depthTex = this.device.createTexture({
        format: Format.D24_S8,
        width: tw,
        height: th,
        usage: TextureUsage.RENDER_TARGET,
      });
      const colorRT = this.device.createRenderTargetFromTexture(colorTex);
      const depthRT = this.device.createRenderTargetFromTexture(depthTex);

      const bakePass = this.device.createRenderPass({
        colorAttachment: [colorRT],
        colorClearColor: [TransparentBlack],
        colorResolveTo: [null],
        colorStore: [true],
        depthStencilAttachment: depthRT,
        depthClearValue: 0,
      });
      bakePass.setViewport(0, 0, tw, th);
      bakePass.setPipeline(this.#bakePipeline);
      bakePass.setBindings(this.#bakeBindings);
      bakePass.setVertexInput(
        this.#bakeInputLayout,
        this.vertexBuffers.map((buffer) => ({ buffer })),
        { buffer: this.indexBuffer },
      );
      bakePass.drawIndexed(this.indexBufferData.length);
      this.device.submitPass(bakePass);

      // Do not call colorRT.destroy(): WebGL {@link RenderTarget_GL.destroy} also destroys
      // the wrapped texture; `colorTex` must stay valid for {@link createPostProcessing}.
      // Same lifetime pattern as {@link MeshGradientPass.render}.
      depthRT.destroy();
      depthTex.destroy();

      this.#rawFillImageTexture = colorTex;
      const filtered = this.#applyRasterFilterChainIfNeeded(
        shape,
        colorTex,
        tw,
        th,
      );
      this.#fillTextureFromPostChain = filtered !== colorTex;
      this.#texture = filtered;
    }

    this.createProgram(vert, physical ? physical_frag : frag, defines);

    if (!this.#uniformBuffer) {
      this.#uniformBuffer = this.device.createBuffer({
        viewOrSize: Float32Array.BYTES_PER_ELEMENT * 60,
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
    }

    this.pipeline = this.renderCache.createRenderPipeline({
      inputLayout: this.inputLayout,
      program: this.program,
      colorAttachmentFormats: [Format.U8_RGBA_RT],
      depthStencilAttachmentFormat: Format.D24_S8,
      megaStateDescriptor: {
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
        depthWrite: true,
        depthCompare: CompareFunction.GREATER,
        stencilWrite: false,
        stencilFront: {
          compare: CompareFunction.ALWAYS,
          passOp: StencilOp.KEEP,
          failOp: StencilOp.KEEP,
          depthFailOp: StencilOp.KEEP,
        },
        stencilBack: {
          compare: CompareFunction.ALWAYS,
          passOp: StencilOp.KEEP,
          failOp: StencilOp.KEEP,
          depthFailOp: StencilOp.KEEP,
        },
      },
    });
    this.device.setResourceName(this.pipeline, 'SDFTextPipeline');

    const sampler = this.renderCache.createSampler({
      addressModeU: AddressMode.CLAMP_TO_EDGE,
      addressModeV: AddressMode.CLAMP_TO_EDGE,
      minFilter: FilterMode.POINT,
      magFilter: FilterMode.BILINEAR,
      mipmapFilter: MipmapFilterMode.LINEAR,
      lodMinClamp: 0,
      lodMaxClamp: 0,
    });

    const sampledTexture =
      useFillImage && this.#texture ? this.#texture : glyphAtlasTexture;

    const bindings: BindingsDescriptor = {
      pipeline: this.pipeline,
      uniformBufferBindings: [
        {
          buffer: uniformBuffer,
        },
        {
          buffer: this.#uniformBuffer,
        },
      ],
      samplerBindings: [
        {
          texture: sampledTexture,
          sampler,
        },
      ],
    };

    this.bindings = this.renderCache.createBindings(bindings);
  }

  #teardownFillImageGpu(): void {
    if (this.#rawFillImageTexture) {
      this.#rawFillImageTexture.destroy();
      this.#rawFillImageTexture = null;
    }
    if (!this.#fillTextureFromPostChain && this.#texture) {
      this.#texture.destroy();
    }
    this.#texture = null;
    this.#fillTextureFromPostChain = false;
  }

  /**
   * @param logicW logic width/height of the bake (matches vertex coords after translate)
   * @param logicH see logicW
   * @param viewportW RT size in pixels (setViewport / u_Viewport)
   * @param viewportH see viewportW
   */
  #writeBakeSceneUniforms(
    logicW: number,
    logicH: number,
    viewportW: number,
    viewportH: number,
  ): void {
    const proj = mat3.projection(mat3.create(), logicW, logicH);
    const view = mat3.identity(mat3.create());
    const vp = mat3.multiply(mat3.create(), proj, view);
    const inv = mat3.invert(mat3.create(), vp) ?? mat3.identity(mat3.create());
    const buf = new Float32Array([
      ...paddingMat3(Mat3.fromGLMat3(proj)),
      ...paddingMat3(Mat3.fromGLMat3(view)),
      ...paddingMat3(Mat3.fromGLMat3(inv)),
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      this.sceneZoomScale,
      0,
      viewportW,
      viewportH,
    ]);
    this.#bakeSceneUniformBuffer!.setSubData(0, new Uint8Array(buf.buffer));
    this.#bakeProgram?.setUniformsLegacy({
      u_ProjectionMatrix: proj,
      u_ViewMatrix: view,
      u_ViewProjectionInvMatrix: inv,
      u_BackgroundColor: [0, 0, 0, 0],
      u_GridColor: [0, 0, 0, 0],
      u_ZoomScale: this.sceneZoomScale,
      u_CheckboardStyle: 0,
      u_Viewport: [viewportW, viewportH],
    });
  }

  #applyRasterFilterChainIfNeeded(
    instance: Entity,
    raw: Texture,
    tw: number,
    th: number,
  ): Texture {
    const filterValue = getRasterFilterValueForShape(instance);
    if (!filterValue) {
      return raw;
    }
    const effects = filterRasterPostEffects(parseEffect(filterValue));
    if (effects.length === 0) {
      return raw;
    }
    this.createPostProcessing(effects, raw, tw, th);
    const { texture: filtered } = this.renderPostProcessingTextureSpace(tw, th);
    return filtered;
  }

  render(
    renderPass: RenderPass,
    uniformBuffer: Buffer,
    uniformLegacyObject: Record<string, unknown>,
  ) {
    // if (
    //   this.shapes.some((shape) => shape.renderDirtyFlag) ||
    //   this.geometryDirty
    // ) {
    const { matrix } = this.shapes[0].read(GlobalTransform);
    const u_ModelMatrix = [
      matrix.m00,
      matrix.m01,
      matrix.m02,
      matrix.m10,
      matrix.m11,
      matrix.m12,
      matrix.m20,
      matrix.m21,
      matrix.m22,
    ] as mat3;

    const [buffer, legacyObject] = this.generateBuffer(
      this.shapes[0],
      this.useBitmapFont
        ? this.shapes[0].read(Text).bitmapFont.pages[0]
        : this.#glyphManager.getAtlas().image,
    );
    this.#uniformBuffer.setSubData(
      0,
      new Uint8Array(
        new Float32Array([
          ...paddingMat3(Mat3.fromGLMat3(u_ModelMatrix)),
          ...buffer,
        ]).buffer,
      ),
    );

    this.program.setUniformsLegacy({
      u_ModelMatrix,
      ...legacyObject,
    });

    if (this.useFillImage && this.#texture) {
      this.program.setUniformsLegacy({ u_Texture: this.#texture });
    }

    if (this.useWireframe && this.geometryDirty) {
      this.generateWireframe();
    }
    // }

    this.program.setUniformsLegacy(uniformLegacyObject);
    renderPass.setPipeline(this.pipeline);
    const vertexBuffers = this.vertexBuffers.map((buffer) => ({ buffer }));
    if (this.useWireframe) {
      vertexBuffers.push({ buffer: this.barycentricBuffer });
    }
    renderPass.setVertexInput(this.inputLayout, vertexBuffers, {
      buffer: this.indexBuffer,
    });
    renderPass.setBindings(this.bindings);
    if (this.useStencil || this.parentClipMode) {
      renderPass.setStencilReference(STENCIL_CLIP_REF);
    }
    renderPass.drawIndexed(this.indexBufferData.length);
  }

  destroy(): void {
    this.destroyFullPostProcessingChain();
    this.#bakeBindings?.destroy();
    this.#bakeBindings = null;
    this.#teardownFillImageGpu();
    this.#bakeSceneUniformBuffer?.destroy();
    this.#bakeSceneUniformBuffer = null;
    super.destroy();
    if (this.program) {
      this.#uniformBuffer?.destroy();
    }
    this.#glyphManager.destroy();
  }

  private generateBuffer(
    shape: Entity,
    image: { width: number; height: number },
  ): [number[], Record<string, unknown>] {
    const sizeAttenuation = shape.has(SizeAttenuation) ? 1 : 0;
    const globalRenderOrder = shape.has(GlobalRenderOrder)
      ? shape.read(GlobalRenderOrder).value
      : 0;
    const zIndex = globalRenderOrder / ZINDEX_FACTOR;
    const { value: fill } = shape.has(FillSolid)
      ? shape.read(FillSolid)
      : { value: null };
    const { r: fr, g: fg, b: fb, opacity: fo } = parseColor(fill);

    const { opacity, strokeOpacity, fillOpacity } = shape.has(Opacity)
      ? shape.read(Opacity)
      : { opacity: 1, strokeOpacity: 1, fillOpacity: 1 };

    const { color: strokeColor, width } = shape.has(Stroke)
      ? shape.read(Stroke)
      : { color: null, width: 0 };
    const { r: sr, g: sg, b: sb, opacity: so } = parseColor(strokeColor);

    const {
      color: dropShadowColor,
      offsetX,
      offsetY,
      blurRadius,
    } = shape.has(DropShadow)
        ? shape.read(DropShadow)
        : { color: null, offsetX: 0, offsetY: 0, blurRadius: 0 };
    const {
      r: dsR,
      g: dsG,
      b: dsB,
      opacity: dsO,
    } = parseColor(dropShadowColor);

    const { width: atlasWidth, height: atlasHeight } = image;

    const { fontSize } = shape.read(ComputedTextMetrics).fontMetrics;

    const u_FillColor = [fr / 255, fg / 255, fb / 255, fo];
    const u_StrokeColor = [sr / 255, sg / 255, sb / 255, so];

    const u_ZIndexStrokeWidth = [zIndex, width, fontSize, 0];

    const u_Opacity = [opacity, fillOpacity, strokeOpacity, sizeAttenuation];

    const u_DropShadowColor = [dsR / 255, dsG / 255, dsB / 255, dsO];
    const u_DropShadow = [offsetX, offsetY, blurRadius, 0];

    const u_AtlasSize = [atlasWidth, atlasHeight];

    let u_FillUVRect: number[];
    if (shape.has(ComputedBounds)) {
      const rb = shape.read(ComputedBounds).renderBounds;
      const rw = rb.maxX - rb.minX;
      const rh = rb.maxY - rb.minY;
      u_FillUVRect = [
        rb.minX,
        rb.minY,
        rw > 0 ? 1 / rw : 0,
        rh > 0 ? 1 / rh : 0,
      ];
    } else {
      u_FillUVRect = [0, 0, 1, 1];
    }

    return [
      [
        ...u_FillColor,
        ...u_StrokeColor,
        ...u_ZIndexStrokeWidth,
        ...u_Opacity,
        ...u_DropShadowColor,
        ...u_DropShadow,
        ...u_AtlasSize,
        0,
        0,
        ...u_FillUVRect,
      ],
      {
        u_FillColor,
        u_StrokeColor,
        u_ZIndexStrokeWidth,
        u_Opacity,
        u_DropShadowColor,
        u_DropShadow,
        u_AtlasSize,
        u_FillUVRect,
      },
    ];
  }

  private buildTextBuffers({
    object,
    lines,
    fontStack,
    lineHeight,
    letterSpacing,
    indicesOffset,
    bitmapFont,
    fontScale,
  }: {
    object: Entity;
    lines: string[];
    fontStack: string;
    lineHeight: number;
    letterSpacing: number;
    indicesOffset: number;
    bitmapFont: BitmapFont;
    fontScale: number;
  }) {
    const { textAlign, bitmapFontKerning } = object.read(Text);

    const metrics = object.read(ComputedTextMetrics);
    const globalRenderOrder = object.has(GlobalRenderOrder)
      ? object.read(GlobalRenderOrder).value
      : 0;

    let x = 0;
    let y = 0;
    // 'start', 'end', 'left', 'right', 'center'
    if (textAlign === 'left' || textAlign === 'start') {
      x = 0;
    } else if (textAlign === 'right' || textAlign === 'end') {
      x = metrics.width;
    } else if (textAlign === 'center') {
      x = metrics.width / 2;
    }

    const {
      fontBoundingBoxAscent = 0,
    } = metrics.fontMetrics;
    y = fontBoundingBoxAscent;

    const charUVOffsetBuffer: number[] = [];
    const charPositionsBuffer: number[] = [];
    const indexBuffer: number[] = [];

    let i = indicesOffset;

    const positionedGlyphs = this.#glyphManager.layout(
      lines,
      fontStack,
      lineHeight,
      textAlign,
      letterSpacing,
      bitmapFont,
      fontScale,
      bitmapFontKerning,
      0,
      (lineHeight - metrics.fontMetrics.fontSize) / 2,
    );

    let positions: GlyphPositions;
    if (bitmapFont) {
      positions = {
        [fontStack]: Object.keys(bitmapFont.chars).reduce((acc, char) => {
          const { xAdvance, xOffset, yOffset, rect } = bitmapFont.chars[char];
          acc[char] = {
            rect,
            metrics: {
              width: xAdvance,
              height: bitmapFont.lineHeight,
              left: xOffset,
              top: -yOffset,
              advance: xAdvance,
            },
          };
          return acc;
        }, {}),
      };
    } else {
      // calculate position information for each individual character relative to the anchor point
      positions = this.#glyphManager.getAtlas().positions;
    }

    getGlyphQuads(positionedGlyphs, positions, this.useBitmapFont).forEach(
      (quad, index, total) => {
        // interleaved uv & offsets
        charUVOffsetBuffer.push(quad.tex.x, quad.tex.y, quad.tl.x, quad.tl.y);
        charUVOffsetBuffer.push(
          quad.tex.x + quad.tex.w,
          quad.tex.y,
          quad.tr.x,
          quad.tr.y,
        );
        charUVOffsetBuffer.push(
          quad.tex.x + quad.tex.w,
          quad.tex.y + quad.tex.h,
          quad.br.x,
          quad.br.y,
        );
        charUVOffsetBuffer.push(
          quad.tex.x,
          quad.tex.y + quad.tex.h,
          quad.bl.x,
          quad.bl.y,
        );

        const zIndex =
          (globalRenderOrder + (1 / total.length) * index) / ZINDEX_FACTOR;
        charPositionsBuffer.push(
          x,
          y,
          zIndex,
          x,
          y,
          zIndex,
          x,
          y,
          zIndex,
          x,
          y,
          zIndex,
        );

        indexBuffer.push(0 + i, 2 + i, 1 + i);
        indexBuffer.push(2 + i, 0 + i, 3 + i);
        i += 4;
      },
    );

    return {
      indexBuffer,
      charUVOffsetBuffer,
      charPositionsBuffer,
      indicesOffset: i,
    };
  }
}
