import {
  Format,
  ResourceType,
  VertexStepMode,
  assert,
  getFormatCompByteSize,
} from '../api';
import type {
  InputLayout,
  InputLayoutBufferDescriptor,
  InputLayoutDescriptor,
} from '../api';
import { isNil } from '@antv/util';
import type { Device_GL } from './Device';
import { ResourceBase_GL } from './ResourceBase';
import {
  getPlatformBuffer,
  isFormatSizedInteger,
  isWebGL2,
  translateIndexFormat,
  translateVertexFormat,
} from './utils';
import { Program_GL } from './Program';

export class InputLayout_GL extends ResourceBase_GL implements InputLayout {
  type: ResourceType.InputLayout = ResourceType.InputLayout;

  vertexBufferDescriptors: (InputLayoutBufferDescriptor | null)[];
  // vertexBufferFormats: ReturnType<typeof translateVertexFormat>[];
  indexBufferFormat: Format | null;
  indexBufferType: GLenum | null;
  indexBufferCompByteSize: number | null;
  vao: WebGLVertexArrayObject;
  program: Program_GL;

  constructor({
    id,
    device,
    descriptor,
  }: {
    id: number;
    device: Device_GL;
    descriptor: InputLayoutDescriptor;
  }) {
    super({ id, device });

    const { vertexBufferDescriptors, indexBufferFormat, program } = descriptor;
    assert(
      indexBufferFormat === Format.U16_R ||
        indexBufferFormat === Format.U32_R ||
        indexBufferFormat === null,
    );
    const indexBufferType =
      indexBufferFormat !== null
        ? translateIndexFormat(indexBufferFormat)
        : null;
    const indexBufferCompByteSize =
      indexBufferFormat !== null
        ? getFormatCompByteSize(indexBufferFormat)
        : null;

    const gl = this.device.gl;
    const vao = this.device.ensureResourceExists(
      isWebGL2(gl)
        ? gl.createVertexArray()
        : device.OES_vertex_array_object.createVertexArrayOES(),
    );
    if (isWebGL2(gl)) {
      gl.bindVertexArray(vao);
    } else {
      device.OES_vertex_array_object.bindVertexArrayOES(vao);
    }

    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      getPlatformBuffer(this.device['fallbackVertexBuffer']),
    );

    // const vertexBufferFormats = [];
    for (const vertexBufferDescriptor of descriptor.vertexBufferDescriptors) {
      const { stepMode, attributes } = vertexBufferDescriptor;

      for (const attribute of attributes) {
        const { shaderLocation, format, divisor = 1 } = attribute;

        // find location by name in WebGL1
        const location = isWebGL2(gl)
          ? shaderLocation
          : (program as Program_GL).attributes[shaderLocation]?.location;

        const vertexFormat = translateVertexFormat(format);
        // @ts-ignore
        attribute.vertexFormat = vertexFormat;

        if (!isNil(location)) {
          if (isFormatSizedInteger(format)) {
            // See https://groups.google.com/d/msg/angleproject/yQb5DaCzcWg/Ova0E3wcAQAJ for more info.
            // console.warn("Vertex format uses sized integer types; this will cause a shader recompile on ANGLE platforms");
            // debugger;
          }

          const { size, type, normalized } = vertexFormat;

          gl.vertexAttribPointer(location, size, type, normalized, 0, 0);

          if (stepMode === VertexStepMode.INSTANCE) {
            if (isWebGL2(gl)) {
              // @see https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/vertexAttribDivisor
              gl.vertexAttribDivisor(location, divisor);
            } else {
              device.ANGLE_instanced_arrays.vertexAttribDivisorANGLE(
                location,
                divisor,
              );
            }
          }

          gl.enableVertexAttribArray(location);
        }
      }
    }

    if (isWebGL2(gl)) {
      gl.bindVertexArray(null);
    } else {
      device.OES_vertex_array_object.bindVertexArrayOES(null);
    }

    this.vertexBufferDescriptors = vertexBufferDescriptors;
    this.vao = vao;
    this.indexBufferFormat = indexBufferFormat;
    this.indexBufferType = indexBufferType;
    this.indexBufferCompByteSize = indexBufferCompByteSize;
    this.program = program as Program_GL;
  }

  destroy() {
    super.destroy();
    if (this.device['currentBoundVAO'] === this.vao) {
      if (isWebGL2(this.device.gl)) {
        this.device.gl.bindVertexArray(null);
        this.device.gl.deleteVertexArray(this.vao);
      } else {
        this.device.OES_vertex_array_object.bindVertexArrayOES(null);
        this.device.OES_vertex_array_object.deleteVertexArrayOES(this.vao);
      }
      this.device['currentBoundVAO'] = null;
    }
  }
}
