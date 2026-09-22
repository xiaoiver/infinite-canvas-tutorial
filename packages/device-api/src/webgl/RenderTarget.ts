import { GL, ResourceType } from '../api';
import { Format, RenderTarget, RenderTargetDescriptor, Texture } from '../api';
import type { Device_GL } from './Device';
import { ResourceBase_GL } from './ResourceBase';
import { isWebGL2 } from './utils';

export class RenderTarget_GL extends ResourceBase_GL implements RenderTarget {
  type: ResourceType.RenderTarget = ResourceType.RenderTarget;
  gl_renderbuffer: WebGLRenderbuffer | null = null;
  texture: Texture | null = null;
  format: Format;
  width: number;
  height: number;
  sampleCount: number;

  constructor({
    id,
    device,
    descriptor,
  }: {
    id: number;
    device: Device_GL;
    descriptor: RenderTargetDescriptor;
  }) {
    super({ id, device });

    const gl = this.device.gl;

    const { format, width, height, sampleCount = 1, texture } = descriptor;

    let useRenderbuffer = false;
    // @see https://blog.tojicode.com/2012/07/using-webgldepthtexture.html
    if (
      (format === Format.D32F || format === Format.D24_S8) &&
      texture &&
      !isWebGL2(gl) &&
      !device.WEBGL_depth_texture
    ) {
      texture.destroy();
      this.texture = null;
      useRenderbuffer = true;
    }

    if (!useRenderbuffer && texture) {
      this.texture = texture;
    } else {
      this.gl_renderbuffer = this.device.ensureResourceExists(
        gl.createRenderbuffer(),
      );
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.gl_renderbuffer);

      const gl_format = this.device.translateTextureInternalFormat(
        format,
        true,
      );

      if (isWebGL2(gl)) {
        if (sampleCount > 1) {
          // @see https://github.com/shrekshao/MoveWebGL1EngineToWebGL2/blob/master/Move-a-WebGL-1-Engine-To-WebGL-2-Blog-2.md#multisampled-renderbuffers
          gl.renderbufferStorageMultisample(
            GL.RENDERBUFFER,
            sampleCount,
            gl_format,
            width,
            height,
          );
        } else {
          gl.renderbufferStorage(GL.RENDERBUFFER, gl_format, width, height);
        }
      } else {
        // WebGL1 can only use FXAA or other post-processing methods
        gl.renderbufferStorage(GL.RENDERBUFFER, gl_format, width, height);
      }
    }
    this.format = format;
    this.width = width;
    this.height = height;
    this.sampleCount = sampleCount;
  }

  destroy() {
    super.destroy();
    if (this.gl_renderbuffer !== null) {
      this.device.gl.deleteRenderbuffer(this.gl_renderbuffer);
    }
    if (this.texture) {
      this.texture.destroy();
    }
  }
}
