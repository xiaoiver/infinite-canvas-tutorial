import { Format, GL } from '../../packages/device-api/src/api';
import * as webglUtils from '../../packages/device-api/src/webgl/utils';
import { Device_GL } from '../../packages/device-api/src/webgl/Device';

describe('WebGL draw defaults', () => {
  function device() {
    const gl = {
      _version: 2,
      drawArrays: jest.fn(),
      drawElementsInstanced: jest.fn(),
      drawElements: jest.fn(),
    };
    const device = Object.assign(Object.create(Device_GL.prototype), {
      gl,
      debugGroupStack: [],
      currentIndexBufferByteOffset: 8,
      currentPipeline: {
        drawMode: 4,
        inputLayout: { indexBufferCompByteSize: 4, indexBufferType: 5125 },
      },
    }) as Device_GL;
    return { device, gl };
  }

  it('uses vertex zero when the caller omits the first vertex', () => {
    const f = device();
    f.device.draw(3);
    expect(f.gl.drawArrays).toHaveBeenCalledWith(4, 0, 3);
  });

  it('uses a finite byte offset when the caller omits the first index', () => {
    const f = device();
    f.device.drawIndexed(6, 1);
    expect(f.gl.drawElementsInstanced).toHaveBeenCalledWith(4, 6, 5125, 8, 1);
    f.device.drawIndexed(6);
    expect(f.gl.drawElements).toHaveBeenCalledWith(4, 6, 5125, 8);
    f.device.drawIndexed(6, 1, 2);
    expect(f.gl.drawElementsInstanced).toHaveBeenLastCalledWith(
      4,
      6,
      5125,
      16,
      1,
    );
  });
  it('keeps packed depth and stencil without the optional depth-texture extension', () => {
    const version = jest.spyOn(webglUtils, 'isWebGL2').mockReturnValue(false);
    try {
      const f = device();
      expect(f.device.translateTextureInternalFormat(Format.D24_S8, true)).toBe(
        GL.DEPTH_STENCIL,
      );
      const attachment = { format: Format.D24_S8 };
      const bind = jest.fn();
      Object.assign(f.gl, {
        DEPTH_STENCIL_ATTACHMENT: GL.DEPTH_STENCIL_ATTACHMENT,
      });
      Object.assign(f.device, { bindFramebufferAttachment: bind });
      (f.device as any).bindFramebufferDepthStencilAttachment(
        GL.FRAMEBUFFER,
        attachment,
      );
      expect(bind).toHaveBeenCalledWith(
        GL.FRAMEBUFFER,
        GL.DEPTH_STENCIL_ATTACHMENT,
        attachment,
        0,
      );
    } finally {
      version.mockRestore();
    }
  });
});
