import {
  BufferFrequencyHint,
  BufferUsage,
  Format,
  VertexStepMode,
} from '@infinite-canvas-tutorial/device-api';
import { Mesh } from './Mesh';
import { ComputedTextMetrics, Text } from '../components';
import { Location } from '../shaders/mesh';
import { textProxyLines } from '../utils/text-lod';

/** One solid quad per nonempty line; shares Mesh color, opacity, transform and ordering. */
export class TextProxy extends Mesh {
  // Eligible text has exactly one solid paint: no raster fill texture is needed.
  protected override get useFillImage() {
    return false;
  }

  override validate() {
    return false;
  }

  override createGeometry() {
    const shape = this.shapes[0];
    const points: number[] = [];
    const indices: number[] = [];
    for (const { x, y, width, height } of textProxyLines(
      shape.read(Text),
      shape.read(ComputedTextMetrics),
    )) {
      const i = points.length / 2;
      points.push(x, y, x + width, y, x + width, y + height, x, y + height);
      indices.push(i, i + 2, i + 1, i + 2, i, i + 3);
    }
    this.points = points;
    this.indexBufferData = new Uint32Array(indices);
    this.vertexBufferDatas[0] = new Float32Array(points);
    this.vertexBuffers[0]?.destroy();
    this.indexBuffer?.destroy();
    this.vertexBuffers[0] = this.device.createBuffer({
      viewOrSize: this.vertexBufferDatas[0],
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.STATIC,
    });
    this.indexBuffer = this.device.createBuffer({
      viewOrSize: this.indexBufferData,
      usage: BufferUsage.INDEX,
      hint: BufferFrequencyHint.STATIC,
    });
    this.vertexBufferDescriptors = [
      {
        arrayStride: 8,
        stepMode: VertexStepMode.VERTEX,
        attributes: [
          {
            shaderLocation: Location.POSITION,
            offset: 0,
            format: Format.F32_RG,
          },
        ],
      },
    ];
  }
}
