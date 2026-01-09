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
  TextureUsage,
  BindingsDescriptor,
  TransparentBlack,
  Texture,
  StencilOp,
} from '@antv/g-device-api';
import { mat3 } from 'gl-matrix';
import { Entity } from '@lastolivegames/becsy';
import { Drawcall, ZINDEX_FACTOR } from './Drawcall';
import { vert, frag, Location } from '../shaders/sdf';
import { paddingMat3, parseColor, parseGradient } from '../utils';
import {
  Circle,
  ComputedBounds,
  Ellipse,
  FillGradient,
  FillImage,
  FillPattern,
  FillSolid,
  FillTexture,
  GlobalRenderOrder,
  GlobalTransform,
  InnerShadow,
  Mat3,
  Opacity,
  Rect,
  SizeAttenuation,
  StrokeAttenuation,
  Stroke,
  Filter,
} from '../components';

const strokeAlignmentMap = {
  center: 0,
  inner: 1,
  outer: 2,
} as const;

export class SDF extends Drawcall {
  // protected maxInstances: number = 1000;

  #uniformBuffer: Buffer;
  #texture: Texture;

  static useDash(shape: Entity) {
    const { dasharray } = shape.has(Stroke)
      ? shape.read(Stroke)
      : { dasharray: [0, 0] };
    return dasharray[0] > 0 && dasharray[1] > 0;
  }

  validate(shape: Entity) {
    const result = super.validate(shape);
    if (!result) {
      return false;
    }

    if (this.shapes.length === 0) {
      return true;
    }

    const isInstanceFillImage = this.shapes[0].has(FillImage);
    const isShapeFillImage = shape.has(FillImage);
    if (isInstanceFillImage !== isShapeFillImage) {
      return false;
    }

    const isInstanceFillGradient = this.shapes[0].has(FillGradient);
    const isShapeFillGradient = shape.has(FillGradient);
    if (isInstanceFillGradient !== isShapeFillGradient) {
      return false;
    }

    if (isInstanceFillImage && isShapeFillImage) {
      return this.shapes[0].read(FillImage).src === shape.read(FillImage).src;
    }

    if (isInstanceFillGradient && isShapeFillGradient) {
      return this.shapes[0].read(FillGradient) === shape.read(FillGradient);
    }

    if (SDF.useDash(shape) !== SDF.useDash(this.shapes[0])) {
      return false;
    }

    if (this.shapes[0].has(Filter) || shape.has(Filter)) {
      return false;
    }

    return true;
  }

  createGeometry(): void {
    this.indexBufferData = new Uint32Array([0, 1, 2, 0, 2, 3]);
    if (this.indexBuffer) {
      this.indexBuffer.destroy();
    }
    this.indexBuffer = this.device.createBuffer({
      viewOrSize: this.indexBufferData,
      usage: BufferUsage.INDEX,
      hint: BufferFrequencyHint.STATIC,
    });

    this.vertexBufferDatas[0] = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);
    if (this.vertexBuffers[0]) {
      this.vertexBuffers[0].destroy();
    }
    this.vertexBuffers[0] = this.device.createBuffer({
      viewOrSize: this.vertexBufferDatas[0],
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });

    if (this.instanced) {
      if (this.vertexBuffers[1]) {
        this.vertexBuffers[1].destroy();
        this.vertexBuffers[2].destroy();
      }

      this.vertexBufferDatas[1] = new Float32Array(
        new Array(32 * this.shapes.length).fill(0),
      );
      this.vertexBuffers[1] = this.device.createBuffer({
        viewOrSize: this.vertexBufferDatas[1],
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });

      this.vertexBufferDatas[2] = new Float32Array(
        new Array(6 * this.shapes.length).fill(0),
      );
      this.vertexBuffers[2] = this.device.createBuffer({
        viewOrSize: this.vertexBufferDatas[2],
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });
    }

    this.vertexBufferDescriptors = [
      {
        arrayStride: 4 * 2,
        stepMode: VertexStepMode.VERTEX,
        attributes: [
          {
            shaderLocation: Location.FRAG_COORD, // a_FragCoord
            offset: 0,
            format: Format.F32_RG,
          },
        ],
      },
    ];

    if (this.instanced) {
      this.vertexBufferDescriptors.push(
        {
          arrayStride: 4 * 32,
          stepMode: VertexStepMode.INSTANCE,
          attributes: [
            {
              shaderLocation: Location.POSITION, // a_Position
              offset: 0,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.SIZE, // a_Size
              offset: 4 * 4,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.FILL_COLOR, // a_FillColor
              offset: 4 * 8,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.STROKE_COLOR, // a_StrokeColor
              offset: 4 * 12,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.ZINDEX_STROKE_WIDTH, // a_ZIndexStrokeWidth
              offset: 4 * 16,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.OPACITY, // a_Opacity
              offset: 4 * 20,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.INNER_SHADOW_COLOR, // a_InnerShadowColor
              offset: 4 * 24,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.INNER_SHADOW, // a_InnerShadow
              offset: 4 * 28,
              format: Format.F32_RGBA,
            },
          ],
        },
        {
          arrayStride: 4 * 6,
          stepMode: VertexStepMode.INSTANCE,
          attributes: [
            {
              shaderLocation: Location.ABCD,
              offset: 0,
              format: Format.F32_RGBA,
            },
            {
              shaderLocation: Location.TXTY,
              offset: 4 * 4,
              format: Format.F32_RG,
            },
          ],
        },
      );
    }
  }

  createMaterial(defines: string, uniformBuffer: Buffer): void {
    this.createProgram(vert, frag, defines);

    if (!this.instanced && !this.#uniformBuffer) {
      this.#uniformBuffer = this.device.createBuffer({
        viewOrSize: Float32Array.BYTES_PER_ELEMENT * (16 + 4 * 8),
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
    this.device.setResourceName(this.pipeline, 'SDFPipeline');

    // const hasFilter = this.shapes[0].has(Filter);

    const bindings: BindingsDescriptor = {
      pipeline: this.pipeline,
      uniformBufferBindings: [
        {
          buffer: uniformBuffer,
        },
      ],
    };
    if (!this.instanced) {
      bindings.uniformBufferBindings!.push({
        buffer: this.#uniformBuffer,
      });
    }

    if (this.useFillImage) {
      if (this.bindings) {
        this.bindings.destroy();
      }

      const instance = this.shapes[0];

      let outputTexture: Texture;

      // if (hasFilter) {
      //   this.#inputPipeline = this.renderCache.createRenderPipeline({
      //     inputLayout: this.inputLayout,
      //     program: this.program,
      //     colorAttachmentFormats: [Format.U8_RGBA_RT],
      //     depthStencilAttachmentFormat: null,
      //     megaStateDescriptor: {
      //       attachmentsState: [
      //         {
      //           channelWriteMask: ChannelWriteMask.ALL,
      //           rgbBlendState: {
      //             blendMode: BlendMode.ADD,
      //             blendSrcFactor: BlendFactor.SRC_ALPHA,
      //             blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
      //           },
      //           alphaBlendState: {
      //             blendMode: BlendMode.ADD,
      //             blendSrcFactor: BlendFactor.ONE,
      //             blendDstFactor: BlendFactor.ONE_MINUS_SRC_ALPHA,
      //           },
      //         },
      //       ],
      //       blendConstant: TransparentBlack,
      //       depthWrite: false,
      //       depthCompare: CompareFunction.ALWAYS,
      //       stencilWrite: false,
      //       stencilFront: {
      //         compare: CompareFunction.ALWAYS,
      //         passOp: StencilOp.KEEP,
      //         failOp: StencilOp.KEEP,
      //         depthFailOp: StencilOp.KEEP,
      //       },
      //       stencilBack: {
      //         compare: CompareFunction.ALWAYS,
      //         passOp: StencilOp.KEEP,
      //         failOp: StencilOp.KEEP,
      //         depthFailOp: StencilOp.KEEP,
      //       },
      //     },
      //   });

      //   const { minX, minY, maxX, maxY } =
      //     this.shapes[0].read(ComputedBounds).renderWorldBounds;
      //   const width = Math.round(maxX - minX);
      //   const height = Math.round(maxY - minY);

      //   const { width: canvasWidth, height: canvasHeight } =
      //     this.swapChain.getCanvas();
      //   const inputTexture = this.device.createTexture({
      //     format: Format.U8_RGBA_RT,
      //     width: canvasWidth,
      //     height: canvasHeight,
      //     usage: TextureUsage.RENDER_TARGET,
      //   });
      //   this.#inputRenderTarget =
      //     this.device.createRenderTargetFromTexture(inputTexture);
      //   this.#inputDepthRenderTarget =
      //     this.device.createRenderTargetFromTexture(
      //       this.device.createTexture({
      //         format: Format.D24_S8,
      //         width: canvasWidth,
      //         height: canvasHeight,
      //         usage: TextureUsage.RENDER_TARGET,
      //       }),
      //     );

      //   const effects = parseEffect(this.shapes[0].read(Filter).value);
      //   const { texture } = this.createPostProcessing(
      //     effects,
      //     inputTexture,
      //     width,
      //     height,
      //   );
      //   outputTexture = texture;
      // }

      if (instance.has(FillGradient) || instance.has(FillPattern)) {
        const { minX, minY, maxX, maxY } =
          instance.read(ComputedBounds).geometryBounds;
        const width = maxX - minX;
        const height = maxY - minY;

        const canvas = instance.has(FillPattern)
          ? this.texturePool.getOrCreatePattern({
              pattern: instance.read(FillPattern),
              width,
              height,
            })
          : this.texturePool.getOrCreateGradient({
              gradients: parseGradient(instance.read(FillGradient).value),
              min: [minX, minY],
              width,
              height,
            });
        const texture = this.device.createTexture({
          format: Format.U8_RGBA_NORM,
          width: 128,
          height: 128,
          usage: TextureUsage.SAMPLED,
        });
        texture.setImageData([canvas]);
        this.#texture = texture;
      } else if (instance.has(FillTexture)) {
        this.#texture = instance.read(FillTexture).value;
      } else if (instance.has(FillImage)) {
        const src = instance.read(FillImage).src as ImageBitmap;
        const texture = this.device.createTexture({
          format: Format.U8_RGBA_NORM,
          width: src.width,
          height: src.height,
          usage: TextureUsage.SAMPLED,
        });
        texture.setImageData([src]);
        this.#texture = texture;
      }

      bindings.samplerBindings = [
        {
          texture: outputTexture ?? this.#texture,
          sampler: this.createSampler(),
        },
      ];

      // if (hasFilter) {
      //   const bindings: BindingsDescriptor = {
      //     pipeline: this.#inputPipeline,
      //     uniformBufferBindings: [
      //       {
      //         buffer: uniformBuffer,
      //       },
      //     ],
      //   };
      //   if (!this.instanced) {
      //     bindings.uniformBufferBindings!.push({
      //       buffer: this.#uniformBuffer,
      //     });
      //   }
      //   if (this.#texture) {
      //     bindings.samplerBindings = [
      //       {
      //         texture: this.#texture,
      //         sampler: this.createSampler(),
      //       },
      //     ];
      //   }

      //   this.#prePassBindings = this.renderCache.createBindings(bindings);
      // }
    }

    this.bindings = this.renderCache.createBindings(bindings);
  }

  render(
    renderPass: RenderPass,
    uniformBuffer: Buffer,
    sceneUniformLegacyObject: Record<string, unknown>,
  ) {
    // const hasFilter = this.shapes[0].has(Filter);

    if (this.instanced) {
      const instancedData: number[] = [];
      this.shapes.forEach((shape, i, total) => {
        const [buffer] = this.generateBuffer(shape, i, total.length);
        instancedData.push(...buffer);
      });
      this.vertexBufferDatas[1] = new Float32Array(instancedData);
      this.vertexBuffers[1].setSubData(
        0,
        new Uint8Array(this.vertexBufferDatas[1].buffer),
      );

      this.vertexBufferDatas[2] = new Float32Array(
        this.shapes
          .map((shape) => {
            const { matrix } = shape.read(GlobalTransform);
            return [
              matrix.m00,
              matrix.m01,
              matrix.m02,
              matrix.m10,
              matrix.m11,
              matrix.m12,
            ];
          })
          .flat(),
      );
      this.vertexBuffers[2].setSubData(
        0,
        new Uint8Array(this.vertexBufferDatas[2].buffer),
      );
    } else {
      const { matrix } = this.shapes[0].read(GlobalTransform);
      const [buffer, legacyObject] = this.generateBuffer(this.shapes[0], 0, 1);
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

      this.#uniformBuffer.setSubData(
        0,
        new Uint8Array(
          new Float32Array([
            ...paddingMat3(Mat3.fromGLMat3(u_ModelMatrix)),
            ...buffer,
          ]).buffer,
        ),
      );
      const uniformLegacyObject: Record<string, unknown> = {
        u_ModelMatrix,
        ...legacyObject,
      };
      if (this.useFillImage) {
        uniformLegacyObject.u_FillImage = this.#texture;
      }
      this.program.setUniformsLegacy(uniformLegacyObject);
    }

    if (this.useWireframe && this.geometryDirty) {
      this.generateWireframe();
    }

    // if (hasFilter) {
    //   const { minX, minY, maxX, maxY } =
    //     this.shapes[0].read(ComputedBounds).renderWorldBounds;

    //   const tl = this.api.canvas2Viewport({ x: minX, y: minY });
    //   const br = this.api.canvas2Viewport({ x: maxX, y: maxY });

    //   const { resized, texture } = this.renderPostProcessing(
    //     tl.x,
    //     tl.y,
    //     Math.round(br.x - tl.x),
    //     Math.round(br.y - tl.y),
    //     Math.round(maxX - minX),
    //     Math.round(maxY - minY),
    //     this.api.getAppState().cameraZoom,
    //   );

    //   if (resized) {
    //     const bindings: BindingsDescriptor = {
    //       pipeline: this.pipeline,
    //       uniformBufferBindings: [
    //         {
    //           buffer: uniformBuffer,
    //         },
    //       ],
    //     };
    //     bindings.uniformBufferBindings!.push({
    //       buffer: this.#uniformBuffer,
    //     });
    //     bindings.samplerBindings = [
    //       {
    //         texture,
    //         sampler: this.createSampler(),
    //       },
    //     ];

    //     this.bindings = this.renderCache.createBindings(bindings);
    //   }
    //   renderPass.setViewport(0, 0, width, height);
    // }

    this.program.setUniformsLegacy(sceneUniformLegacyObject);
    renderPass.setPipeline(this.pipeline);

    const vertexBuffers = this.vertexBuffers.map((buffer) => ({ buffer }));
    if (this.useWireframe) {
      vertexBuffers.push({ buffer: this.barycentricBuffer });
    }
    renderPass.setVertexInput(this.inputLayout, vertexBuffers, {
      buffer: this.indexBuffer,
    });
    renderPass.setBindings(this.bindings);
    renderPass.drawIndexed(6, this.shapes.length);
  }

  destroy(): void {
    super.destroy();
    if (this.program) {
      this.#uniformBuffer?.destroy();
      this.#texture?.destroy?.();
      this.#uniformBuffer = null;
      this.#texture = null;
    }
  }

  private generateBuffer(
    shape: Entity,
    index: number,
    total: number,
  ): [number[], Record<string, unknown>] {
    const globalRenderOrder = shape.has(GlobalRenderOrder)
      ? shape.read(GlobalRenderOrder).value
      : 0;

    let position: [number, number, number, number] = [0, 0, 0, 0];
    let size: [number, number, number, number] = [0, 0, 0, 0];
    let type: number = 0;
    let cornerRadius = 0;
    const zIndex = (globalRenderOrder + (1 / total) * index) / ZINDEX_FACTOR;

    if (shape.has(Circle)) {
      const { cx, cy, r } = shape.read(Circle);
      position = [cx, cy, zIndex, 0];
      size = [r, r, 0, 0];
      type = 0;
    } else if (shape.has(Ellipse)) {
      const { cx, cy, rx, ry } = shape.read(Ellipse);
      position = [cx, cy, zIndex, 0];
      size = [rx, ry, 0, 0];
      type = 1;
    } else if (shape.has(Rect)) {
      const { x, y, width, height, cornerRadius: r } = shape.read(Rect);
      position = [x + width / 2, y + height / 2, zIndex, 0];
      size = [width / 2, height / 2, 0, 0];
      type = 2;
      cornerRadius = r;
    }

    const { value: fill } = shape.has(FillSolid)
      ? shape.read(FillSolid)
      : { value: null };
    const { r: fr, g: fg, b: fb, opacity: fo } = parseColor(fill);

    const { opacity, strokeOpacity, fillOpacity } = shape.has(Opacity)
      ? shape.read(Opacity)
      : { opacity: 1, strokeOpacity: 1, fillOpacity: 1 };

    const {
      color: strokeColor,
      width,
      alignment,
    } = shape.has(Stroke)
      ? shape.read(Stroke)
      : { color: null, width: 0, alignment: 'center' };
    const {
      color: innerShadowColor,
      offsetX,
      offsetY,
      blurRadius,
    } = shape.has(InnerShadow)
      ? shape.read(InnerShadow)
      : {
          color: null,
          offsetX: 0,
          offsetY: 0,
          blurRadius: 0,
        };
    const { r: sr, g: sg, b: sb, opacity: so } = parseColor(strokeColor);
    const {
      r: isr,
      g: isg,
      b: isb,
      opacity: iso,
    } = parseColor(innerShadowColor);

    const u_Position = position;
    const u_Size = size;
    const u_FillColor = [fr / 255, fg / 255, fb / 255, fo];
    const u_StrokeColor = [sr / 255, sg / 255, sb / 255, so];
    const u_ZIndexStrokeWidth = [
      globalRenderOrder / ZINDEX_FACTOR,
      SDF.useDash(shape) ? 0 : width,
      cornerRadius,
      strokeAlignmentMap[alignment],
    ];

    const LEFT_SHIFT22 = 4194304.0;
    const LEFT_SHIFT23 = 8388608.0;
    const compressed =
      (shape.has(SizeAttenuation) ? 1 : 0) * LEFT_SHIFT23 +
      (shape.has(StrokeAttenuation) ? 1 : 0) * LEFT_SHIFT22 +
      type;
    const u_Opacity = [opacity, fillOpacity, strokeOpacity, compressed];
    const u_InnerShadowColor = [isr / 255, isg / 255, isb / 255, iso];
    const u_InnerShadow = [offsetX, offsetY, blurRadius, 0];

    return [
      [
        ...u_Position,
        ...u_Size,
        ...u_FillColor,
        ...u_StrokeColor,
        ...u_ZIndexStrokeWidth,
        ...u_Opacity,
        ...u_InnerShadowColor,
        ...u_InnerShadow,
      ],
      {
        u_Position,
        u_Size,
        u_FillColor,
        u_StrokeColor,
        u_ZIndexStrokeWidth,
        u_Opacity,
        u_InnerShadowColor,
        u_InnerShadow,
      },
    ];
  }
}
