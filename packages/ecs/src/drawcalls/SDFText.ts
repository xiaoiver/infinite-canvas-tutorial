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
} from '@antv/g-device-api';
import { Entity } from '@lastolivegames/becsy';
import { mat3 } from 'gl-matrix';
import { Drawcall, ZINDEX_FACTOR } from './Drawcall';
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
  ComputedTextMetrics,
  DropShadow,
  FillSolid,
  GlobalRenderOrder,
  GlobalTransform,
  Mat3,
  Opacity,
  Stroke,
  Text,
} from '../components';

export class SDFText extends Drawcall {
  #glyphManager = new GlyphManager();
  #uniformBuffer: Buffer;
  #texture: Texture;

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
    const font = shape.has(ComputedTextMetrics)
      ? shape.read(ComputedTextMetrics)
      : '';
    const blurRadius = shape.has(DropShadow)
      ? shape.read(DropShadow).blurRadius
      : 0;
    return `${font}-${bitmapFont?.fontFamily}-${physical}-${blurRadius}`;
  }

  private get useBitmapFont() {
    return !!this.shapes[0].read(Text).bitmapFont;
  }

  createGeometry(): void {
    const { fontFamily, fontWeight, fontStyle, bitmapFont, esdt, content } =
      this.shapes[0].read(Text);
    const { font, fontMetrics } = this.shapes[0].read(ComputedTextMetrics);
    const { value: fill } = this.shapes[0].has(FillSolid)
      ? this.shapes[0].read(FillSolid)
      : { value: 'black' };

    const hasEmoji = containsEmoji(content);

    const indices: number[] = [];
    const positions: number[] = [];
    const uvOffsets: number[] = [];
    let indicesOff = 0;
    let fontScale: number;

    if (this.useBitmapFont) {
      fontScale = fontMetrics.fontSize / bitmapFont.baseMeasurementFontSize;
    } else {
      // scale current font size to base(24)
      fontScale = fontMetrics.fontSize / (BASE_FONT_WIDTH / SDF_SCALE);
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
    const { content, physical } = this.shapes[0].read(Text);
    const { blurRadius } = this.shapes[0].has(DropShadow)
      ? this.shapes[0].read(DropShadow)
      : { blurRadius: 0 };

    let glyphAtlasTexture: Texture;
    if (this.useBitmapFont) {
      const { bitmapFont } = this.shapes[0].read(Text);
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

    this.createProgram(vert, physical ? physical_frag : frag, defines);

    if (!this.#uniformBuffer) {
      this.#uniformBuffer = this.device.createBuffer({
        viewOrSize:
          Float32Array.BYTES_PER_ELEMENT * (16 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4),
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
          texture: glyphAtlasTexture,
          sampler,
        },
      ],
    };

    this.bindings = this.renderCache.createBindings(bindings);
  }

  render(renderPass: RenderPass, uniformLegacyObject: Record<string, unknown>) {
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

    if (this.useWireframe) {
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
    renderPass.drawIndexed(this.indexBufferData.length);
  }

  destroy(): void {
    super.destroy();
    if (this.program) {
      this.#uniformBuffer?.destroy();
      this.#texture?.destroy();
    }

    this.#glyphManager.destroy();
  }

  private generateBuffer(
    shape: Entity,
    image: { width: number; height: number },
  ): [number[], Record<string, unknown>] {
    const sizeAttenuation = 0;
    const globalRenderOrder = shape.has(GlobalRenderOrder)
      ? shape.read(GlobalRenderOrder).value
      : 0;

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

    const u_ZIndexStrokeWidth = [
      globalRenderOrder / ZINDEX_FACTOR,
      width,
      fontSize,
      0,
    ];

    const u_Opacity = [
      opacity,
      fillOpacity,
      strokeOpacity,
      sizeAttenuation ? 1 : 0,
    ];

    const u_DropShadowColor = [dsR / 255, dsG / 255, dsB / 255, dsO];
    const u_DropShadow = [offsetX, offsetY, blurRadius, 0];

    const u_AtlasSize = [atlasWidth, atlasHeight];

    return [
      [
        ...u_FillColor,
        ...u_StrokeColor,
        ...u_ZIndexStrokeWidth,
        ...u_Opacity,
        ...u_DropShadowColor,
        ...u_DropShadow,
        ...u_AtlasSize,
      ],
      {
        u_FillColor,
        u_StrokeColor,
        u_ZIndexStrokeWidth,
        u_Opacity,
        u_DropShadowColor,
        u_DropShadow,
        u_AtlasSize,
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
    const { textAlign, textBaseline, bitmapFontKerning } = object.read(Text);
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
      fontBoundingBoxDescent = 0,
      hangingBaseline = 0,
      ideographicBaseline = 0,
    } = metrics.fontMetrics;
    if (textBaseline === 'alphabetic') {
      y = fontBoundingBoxAscent;
    } else if (textBaseline === 'middle') {
      y = fontBoundingBoxAscent;
    } else if (textBaseline === 'hanging') {
      y = hangingBaseline;
    } else if (textBaseline === 'ideographic') {
      y = ideographicBaseline;
    } else if (textBaseline === 'bottom') {
      y = fontBoundingBoxAscent + fontBoundingBoxDescent;
    } else if (textBaseline === 'top') {
      y = 0;
    }

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
      0,
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
