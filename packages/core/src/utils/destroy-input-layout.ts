import type { InputLayout } from '@antv/g-device-api';

/**
 * g-device-api 1.6.13 only deletes a VAO when it is currently bound. Its public
 * concrete WebGL resource exposes the native VAO/device. Finish deletion without
 * binding anything or changing the device's cached state; WebGPU is unchanged.
 */
export function destroyInputLayout(layout: InputLayout) {
  layout.destroy();
  if (!('vao' in layout) || !('device' in layout)) return;
  const { vao, device } = layout as InputLayout & {
    vao: WebGLVertexArrayObject;
    device: {
      gl: WebGL2RenderingContext;
      OES_vertex_array_object?: OES_vertex_array_object;
    };
  };
  const gl = device.gl;
  if (typeof gl.isVertexArray === 'function') {
    if (gl.isVertexArray(vao)) gl.deleteVertexArray(vao);
  } else {
    const ext = device.OES_vertex_array_object;
    if (ext?.isVertexArrayOES(vao)) ext.deleteVertexArrayOES(vao);
  }
}
