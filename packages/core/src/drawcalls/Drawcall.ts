import {
  Buffer,
  Device,
  InputLayoutBufferDescriptor,
  Program,
  RenderPass,
  RenderPipeline,
  InputLayout,
  Bindings,
  BufferUsage,
  BufferFrequencyHint,
  VertexStepMode,
  Format,
} from '@antv/g-device-api';
import { Shape } from '../shapes';
import { RenderCache } from '../utils/render-cache';
import { isString, uid } from '../utils';
import { Location } from '../shaders/wireframe';

// TODO: Use a more efficient way to manage Z index.
export const ZINDEX_FACTOR = 100000;

export abstract class Drawcall {
  uid = uid();

  shapes: Shape[] = [];

  /**
   * Create a new batch if the number of instances exceeds.
   */
  protected maxInstances = Infinity;

  geometryDirty = true;
  materialDirty = true;
  destroyed = false;

  protected program: Program;
  protected pipeline: RenderPipeline;
  protected inputLayout: InputLayout;
  protected bindings: Bindings;

  protected indexBuffer: Buffer;
  protected indexBufferData: Uint32Array;

  protected vertexBuffers: Buffer[] = [];
  protected vertexBufferDatas: Float32Array[] = [];
  protected vertexBufferOffsets: number[] = [];

  protected vertexBufferDescriptors: InputLayoutBufferDescriptor[];
  protected barycentricBufferIndex = -1;

  constructor(
    protected device: Device,
    protected renderCache: RenderCache,
    protected instanced: boolean,
    protected index: number,
  ) {}

  abstract createGeometry(): void;
  abstract createMaterial(uniformBuffer: Buffer): void;
  abstract render(
    renderPass: RenderPass,
    uniformLegacyObject: Record<string, unknown>,
  ): void;

  destroy() {
    if (this.program) {
      this.indexBuffer?.destroy();
      this.vertexBuffers.forEach((buffer) => buffer.destroy());
      this.vertexBuffers = [];
      this.vertexBufferDatas = [];
      this.vertexBufferDescriptors = [];
    }
    this.destroyed = true;
  }

  validate(shape: Shape) {
    if (this.shapes[0]?.wireframe !== shape.wireframe) {
      return false;
    }

    return this.count() <= this.maxInstances - 1;
  }

  submit(
    renderPass: RenderPass,
    uniformBuffer: Buffer,
    uniformLegacyObject: Record<string, unknown>,
  ) {
    if (this.geometryDirty) {
      this.createGeometry();

      if (this.useWireframe) {
        this.generateWireframeVertexBufferDescriptors();
      }
    }

    if (this.materialDirty) {
      this.createMaterial(uniformBuffer);
    }

    this.render(renderPass, uniformLegacyObject);

    if (this.geometryDirty) {
      this.geometryDirty = false;
    }

    if (this.materialDirty) {
      this.materialDirty = false;
    }
  }

  add(shape: Shape) {
    if (!this.shapes.includes(shape)) {
      this.shapes.push(shape);
      this.geometryDirty = true;
    }
  }

  remove(shape: Shape) {
    if (this.shapes.includes(shape)) {
      const index = this.shapes.indexOf(shape);
      this.shapes.splice(index, 1);
      this.geometryDirty = true;
    }
  }

  count() {
    return this.shapes.length;
  }

  protected get useWireframe() {
    return this.shapes[0]?.wireframe;
  }

  protected get useFillImage() {
    const { fill } = this.shapes[0];
    return !isString(fill);
    // && (isBrowser ? isImageBitmapOrCanvases(fill) : true)
  }

  protected generateWireframeVertexBufferDescriptors() {
    const barycentricBufferDescriptor = {
      arrayStride: 4 * 3,
      stepMode: VertexStepMode.VERTEX,
      attributes: [
        {
          shaderLocation: Location.BARYCENTRIC, // a_Barycentric
          offset: 0,
          format: Format.F32_RGB,
        },
      ],
    };

    if (this.barycentricBufferIndex === -1) {
      this.vertexBufferDescriptors.push(barycentricBufferDescriptor);
      this.barycentricBufferIndex = this.vertexBufferDescriptors.length - 1;
    } else {
      this.vertexBufferDescriptors[this.barycentricBufferIndex] =
        barycentricBufferDescriptor;
    }
  }

  protected generateWireframe() {
    const indiceNum = this.indexBufferData.length;
    const originalVertexBuffers = this.vertexBufferDatas.map((buffer) => {
      return buffer.slice();
    });

    for (let i = 0; i < this.vertexBufferDatas.length; i++) {
      if (i === this.barycentricBufferIndex) {
        continue;
      }

      const { arrayStride, stepMode } = this.vertexBufferDescriptors[i];
      if (stepMode === VertexStepMode.VERTEX) {
        this.vertexBufferDatas[i] = new Float32Array(
          (arrayStride / Float32Array.BYTES_PER_ELEMENT) * indiceNum,
        );
      } else {
        this.vertexBufferDatas[i] = originalVertexBuffers[i];
      }
    }

    // reallocate attribute data
    let cursor = 0;
    const uniqueIndices = new Uint32Array(indiceNum);
    for (let i = 0; i < indiceNum; i++) {
      const ii = this.indexBufferData[i];
      for (let j = 0; j < this.vertexBufferDatas.length; j++) {
        if (j === this.barycentricBufferIndex) {
          continue;
        }

        const { arrayStride, stepMode } = this.vertexBufferDescriptors[j];

        if (stepMode === VertexStepMode.VERTEX) {
          const size = arrayStride / Float32Array.BYTES_PER_ELEMENT;
          for (let k = 0; k < size; k++) {
            this.vertexBufferDatas[j][cursor * size + k] =
              originalVertexBuffers[j][ii * size + k];
          }
        }
      }
      uniqueIndices[i] = cursor;
      cursor++;
    }

    for (let i = 0; i < this.vertexBuffers.length; i++) {
      if (i === this.barycentricBufferIndex) {
        continue;
      }

      this.vertexBuffers[i].destroy();
      this.vertexBuffers[i] = this.device.createBuffer({
        viewOrSize: this.vertexBufferDatas[i],
        usage: BufferUsage.VERTEX,
        hint: BufferFrequencyHint.DYNAMIC,
      });
    }

    // create barycentric attributes
    const barycentricBufferData = new Float32Array(indiceNum * 3);
    for (let i = 0; i < indiceNum; ) {
      for (let j = 0; j < 3; j++) {
        const ii = uniqueIndices[i++];
        barycentricBufferData[ii * 3 + j] = 1;
      }
    }

    const barycentricBuffer = this.device.createBuffer({
      viewOrSize: barycentricBufferData,
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    if (this.indexBuffer) {
      this.indexBuffer.destroy();
    }
    this.indexBuffer = this.device.createBuffer({
      viewOrSize: uniqueIndices,
      usage: BufferUsage.INDEX,
      hint: BufferFrequencyHint.STATIC,
    });

    if (this.barycentricBufferIndex === -1) {
      this.barycentricBufferIndex = this.vertexBufferDescriptors.length - 1;
      this.vertexBuffers.push(barycentricBuffer);
      this.vertexBufferDatas.push(barycentricBufferData);
    } else {
      this.vertexBuffers[this.barycentricBufferIndex]?.destroy();
      this.vertexBuffers[this.barycentricBufferIndex] = barycentricBuffer;
      this.vertexBufferDatas[this.barycentricBufferIndex] =
        barycentricBufferData;
    }

    console.log(originalVertexBuffers, this.vertexBufferDatas);
  }
}
