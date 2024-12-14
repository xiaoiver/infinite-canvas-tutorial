import {
  type RenderPass,
  Bindings,
  Buffer,
  BufferFrequencyHint,
  BufferUsage,
  BlendMode,
  BlendFactor,
  ChannelWriteMask,
  Format,
  InputLayout,
  RenderPipeline,
  VertexStepMode,
  Program,
  CompareFunction,
  BindingsDescriptor,
  AddressMode,
  FilterMode,
  MipmapFilterMode,
  TransparentBlack,
  Texture,
  StencilOp,
} from '@antv/g-device-api';
import { Shape, Text } from '../shapes';
import { Drawcall, ZINDEX_FACTOR } from './Drawcall';
import { vert, frag, Location } from '../shaders/sdf_text';
import {
  BASE_FONT_WIDTH,
  canvasTextMetrics,
  GlyphManager,
  paddingMat3,
  getGlyphQuads,
} from '../utils';

export class SDFText extends Drawcall {
  #glyphManager = new GlyphManager();
  #program: Program;
  #positionBuffer: Buffer;
  #uvOffsetBuffer: Buffer;
  #indexBuffer: Buffer;
  #uniformBuffer: Buffer;
  #pipeline: RenderPipeline;
  #inputLayout: InputLayout;
  #bindings: Bindings;
  #texture: Texture;

  #indices: number[] = [];

  validate(shape: Shape) {
    const result = super.validate(shape);
    if (!result) {
      return false;
    }

    if (this.shapes.length === 0) {
      return true;
    }

    return true;
  }

  createGeometry(): void {
    const { metrics, fontFamily, fontWeight, fontStyle, textBaseline } = this
      .shapes[0] as Text;

    // scale current font size to base(24)
    const fontScale = BASE_FONT_WIDTH / metrics.fontProperties.fontSize;
    const allText = this.shapes.map((text: Text) => text.content).join('');

    this.#glyphManager.generateAtlas(
      canvasTextMetrics.getCanvas(),
      metrics.font,
      fontFamily,
      fontWeight.toString(),
      fontStyle,
      allText,
      this.device,
    );

    const indices: number[] = [];
    this.#indices = indices;
    const positions: number[] = [];
    const uvOffsets: number[] = [];
    let indicesOff = 0;

    this.shapes.forEach((object: Text) => {
      const { metrics, letterSpacing, dx = 0, dy = 0 } = object;
      const { font, lines, height, lineHeight } = metrics;

      // account for dx & dy
      const offsetX = dx;
      const offsetY = dy;

      // if (textBaseline === 'alphabetic') {
      //   textBaseline = 'bottom';
      // }

      let linePositionY = 0;
      // handle vertical text baseline
      if (textBaseline === 'middle') {
        linePositionY += -height / 2;
      } else if (textBaseline === 'bottom') {
        linePositionY += -height;
      } else if (textBaseline === 'top' || textBaseline === 'hanging') {
        linePositionY += 0;
      } else if (textBaseline === 'ideographic') {
        linePositionY += -height;
      }

      const {
        indicesOffset,
        indexBuffer,
        charUVOffsetBuffer,
        charPositionsBuffer,
      } = this.buildTextBuffers({
        object,
        lines,
        fontStack: font,
        lineHeight: fontScale * lineHeight,
        offsetX: fontScale * offsetX,
        offsetY: fontScale * (linePositionY + offsetY),
        letterSpacing: fontScale * letterSpacing,
        indicesOffset: indicesOff,
      });
      indicesOff = indicesOffset;

      uvOffsets.push(...charUVOffsetBuffer);
      positions.push(...charPositionsBuffer);
      indices.push(...indexBuffer);
    });

    this.#positionBuffer = this.device.createBuffer({
      viewOrSize: new Float32Array(positions),
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });
    this.#uvOffsetBuffer = this.device.createBuffer({
      viewOrSize: new Float32Array(uvOffsets),
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });
    this.#indexBuffer = this.device.createBuffer({
      viewOrSize: new Uint32Array(indices),
      usage: BufferUsage.INDEX,
      hint: BufferFrequencyHint.STATIC,
    });
  }

  createMaterial(uniformBuffer: Buffer): void {
    const glyphAtlasTexture = this.#glyphManager.getAtlasTexture();

    this.device.setResourceName(glyphAtlasTexture, 'SDFText Texture');

    let defines = '';
    if (this.instanced) {
      defines += '#define USE_INSTANCES\n';
    }

    const diagnosticDerivativeUniformityHeader =
      this.device.queryVendorInfo().platformString === 'WebGPU'
        ? 'diagnostic(off,derivative_uniformity);\n'
        : '';

    this.#program = this.renderCache.createProgram({
      vertex: {
        glsl: defines + vert,
      },
      fragment: {
        glsl: defines + frag,
        postprocess: (fs) => diagnosticDerivativeUniformityHeader + fs,
      },
    });

    const vertexBufferDescriptors = [
      {
        arrayStride: 4 * 2,
        stepMode: VertexStepMode.VERTEX,
        attributes: [
          {
            shaderLocation: Location.POSITION, // a_Position
            offset: 0,
            format: Format.F32_RG,
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

    this.#inputLayout = this.renderCache.createInputLayout({
      vertexBufferDescriptors,
      indexBufferFormat: Format.U32_R,
      program: this.#program,
    });
    if (!this.#uniformBuffer) {
      this.#uniformBuffer = this.device.createBuffer({
        viewOrSize:
          Float32Array.BYTES_PER_ELEMENT * (16 + 4 + 4 + 4 + 4 + 4 + 4),
        usage: BufferUsage.UNIFORM,
        hint: BufferFrequencyHint.DYNAMIC,
      });
    }

    this.#pipeline = this.renderCache.createRenderPipeline({
      inputLayout: this.#inputLayout,
      program: this.#program,
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
    this.device.setResourceName(this.#pipeline, 'SDFTextPipeline');

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
      pipeline: this.#pipeline,
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

    this.#bindings = this.renderCache.createBindings(bindings);
  }

  render(renderPass: RenderPass, uniformLegacyObject: Record<string, unknown>) {
    if (
      this.shapes.some((shape) => shape.renderDirtyFlag) ||
      this.geometryDirty
    ) {
      const { worldTransform } = this.shapes[0];
      const [buffer, legacyObject] = this.generateBuffer(
        this.shapes[0] as Text,
      );
      const u_ModelMatrix = worldTransform.toArray(true);
      this.#uniformBuffer.setSubData(
        0,
        new Uint8Array(
          new Float32Array([...paddingMat3(u_ModelMatrix), ...buffer]).buffer,
        ),
      );
      const uniformLegacyObject: Record<string, unknown> = {
        u_ModelMatrix,
        ...legacyObject,
      };
      this.#program.setUniformsLegacy(uniformLegacyObject);
    }

    const buffers = [
      {
        buffer: this.#positionBuffer,
      },
      {
        buffer: this.#uvOffsetBuffer,
      },
    ];

    this.#program.setUniformsLegacy(uniformLegacyObject);
    renderPass.setPipeline(this.#pipeline);
    renderPass.setVertexInput(this.#inputLayout, buffers, {
      buffer: this.#indexBuffer,
    });
    renderPass.setBindings(this.#bindings);
    renderPass.drawIndexed(this.#indices.length);
  }

  destroy(): void {
    super.destroy();
    if (this.#program) {
      this.#positionBuffer?.destroy();
      this.#uvOffsetBuffer?.destroy();
      this.#indexBuffer?.destroy();
      this.#uniformBuffer?.destroy();
      this.#texture?.destroy();
    }

    this.#glyphManager.destroy();
  }

  private generateBuffer(shape: Text): [number[], Record<string, unknown>] {
    const {
      fillRGB,
      strokeRGB: { r: sr, g: sg, b: sb, opacity: so },
      strokeWidth,
      opacity,
      fillOpacity,
      strokeOpacity,
      sizeAttenuation,
      metrics,
    } = shape;

    const glyphAtlas = this.#glyphManager.getAtlas();
    const { width: atlasWidth, height: atlasHeight } = glyphAtlas.image;

    const { r: fr, g: fg, b: fb, opacity: fo } = fillRGB || {};

    const u_FillColor = [fr / 255, fg / 255, fb / 255, fo];
    const u_StrokeColor = [sr / 255, sg / 255, sb / 255, so];
    const u_ZIndexStrokeWidth = [
      shape.globalRenderOrder / ZINDEX_FACTOR,
      strokeWidth,
      metrics.fontProperties.fontSize,
      0,
    ];

    const u_Opacity = [
      opacity,
      fillOpacity,
      strokeOpacity,
      sizeAttenuation ? 1 : 0,
    ];

    const u_AtlasSize = [atlasWidth, atlasHeight];

    return [
      [
        ...u_FillColor,
        ...u_StrokeColor,
        ...u_ZIndexStrokeWidth,
        ...u_Opacity,
        ...u_AtlasSize,
      ],
      {
        u_FillColor,
        u_StrokeColor,
        u_ZIndexStrokeWidth,
        u_Opacity,
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
    offsetX,
    offsetY,
    indicesOffset,
  }: {
    object: Text;
    lines: string[];
    fontStack: string;
    lineHeight: number;
    letterSpacing: number;
    offsetX: number;
    offsetY: number;
    indicesOffset: number;
  }) {
    const { textAlign = 'start', x = 0, y = 0 } = object;

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
      offsetX,
      offsetY,
    );

    // 计算每个独立字符相对于锚点的位置信息
    const glyphAtlas = this.#glyphManager.getAtlas();
    const glyphQuads = getGlyphQuads(positionedGlyphs, glyphAtlas.positions);

    glyphQuads.forEach((quad) => {
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
      charPositionsBuffer.push(x, y, x, y, x, y, x, y);

      indexBuffer.push(0 + i, 2 + i, 1 + i);
      indexBuffer.push(2 + i, 0 + i, 3 + i);
      i += 4;
    });

    return {
      indexBuffer,
      charUVOffsetBuffer,
      charPositionsBuffer,
      indicesOffset: i,
    };
  }
}
