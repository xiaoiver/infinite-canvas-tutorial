import {
  GL,
  MipmapFilterMode,
  ResourceType,
  FilterMode,
  assert,
  isPowerOfTwo,
} from '../api';
import type { Sampler, SamplerDescriptor } from '../api';
import type { Device_GL } from './Device';
import { ResourceBase_GL } from './ResourceBase';
import {
  getPlatformSampler,
  isWebGL2,
  translateFilterMode,
  translateAddressMode,
} from './utils';

/**
 * In WebGL 1 texture image data and sampling information are both stored in texture objects
 * @see https://github.com/shrekshao/MoveWebGL1EngineToWebGL2/blob/master/Move-a-WebGL-1-Engine-To-WebGL-2-Blog-2.md#sampler-objects
 */
export class Sampler_GL extends ResourceBase_GL implements Sampler {
  type: ResourceType.Sampler = ResourceType.Sampler;

  gl_sampler: WebGLSampler;
  descriptor: SamplerDescriptor;

  constructor({
    id,
    device,
    descriptor,
  }: {
    id: number;
    device: Device_GL;
    descriptor: SamplerDescriptor;
  }) {
    super({ id, device });

    const gl = this.device.gl;

    if (isWebGL2(gl)) {
      const gl_sampler = this.device.ensureResourceExists(gl.createSampler());
      gl.samplerParameteri(
        gl_sampler,
        GL.TEXTURE_WRAP_S,
        translateAddressMode(descriptor.addressModeU),
      );
      gl.samplerParameteri(
        gl_sampler,
        GL.TEXTURE_WRAP_T,
        translateAddressMode(descriptor.addressModeV),
      );
      gl.samplerParameteri(
        gl_sampler,
        GL.TEXTURE_WRAP_R,
        translateAddressMode(
          descriptor.addressModeW ?? descriptor.addressModeU,
        ),
      );
      gl.samplerParameteri(
        gl_sampler,
        GL.TEXTURE_MIN_FILTER,
        translateFilterMode(descriptor.minFilter, descriptor.mipmapFilter),
      );
      gl.samplerParameteri(
        gl_sampler,
        GL.TEXTURE_MAG_FILTER,
        translateFilterMode(descriptor.magFilter, MipmapFilterMode.NO_MIP),
      );

      if (descriptor.lodMinClamp !== undefined) {
        gl.samplerParameterf(
          gl_sampler,
          GL.TEXTURE_MIN_LOD,
          descriptor.lodMinClamp,
        );
      }
      if (descriptor.lodMaxClamp !== undefined) {
        gl.samplerParameterf(
          gl_sampler,
          GL.TEXTURE_MAX_LOD,
          descriptor.lodMaxClamp,
        );
      }
      if (descriptor.compareFunction !== undefined) {
        gl.samplerParameteri(
          gl_sampler,
          gl.TEXTURE_COMPARE_MODE,
          gl.COMPARE_REF_TO_TEXTURE,
        );
        gl.samplerParameteri(
          gl_sampler,
          gl.TEXTURE_COMPARE_FUNC,
          descriptor.compareFunction,
        );
      }

      const maxAnisotropy = descriptor.maxAnisotropy ?? 1;
      if (
        maxAnisotropy > 1 &&
        this.device.EXT_texture_filter_anisotropic !== null
      ) {
        assert(
          descriptor.minFilter === FilterMode.BILINEAR &&
            descriptor.magFilter === FilterMode.BILINEAR &&
            descriptor.mipmapFilter === MipmapFilterMode.LINEAR,
        );
        gl.samplerParameterf(
          gl_sampler,
          this.device.EXT_texture_filter_anisotropic.TEXTURE_MAX_ANISOTROPY_EXT,
          maxAnisotropy,
        );
      }

      this.gl_sampler = gl_sampler;
    } else {
      // use later in WebGL1
      this.descriptor = descriptor;
    }
  }

  setTextureParameters(gl_target: number, width: number, height: number): void {
    const gl = this.device.gl;
    const descriptor = this.descriptor;

    // @see https://developer.mozilla.org/zh-CN/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL#%E9%9D%9E2%E7%9A%84%E5%B9%82%E7%BA%B9%E7%90%86
    if (this.isNPOT(width, height)) {
      gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
    } else {
      gl.texParameteri(
        gl_target,
        GL.TEXTURE_MIN_FILTER,
        translateFilterMode(descriptor.minFilter, descriptor.mipmapFilter),
      );
    }
    gl.texParameteri(
      GL.TEXTURE_2D,
      GL.TEXTURE_WRAP_S,
      translateAddressMode(descriptor.addressModeU),
    );
    gl.texParameteri(
      GL.TEXTURE_2D,
      GL.TEXTURE_WRAP_T,
      translateAddressMode(descriptor.addressModeV),
    );

    gl.texParameteri(
      gl_target,
      GL.TEXTURE_MAG_FILTER,
      translateFilterMode(descriptor.magFilter, MipmapFilterMode.NO_MIP),
    );

    // if (descriptor.lodMinClamp !== undefined) {
    //   gl.texParameterf(gl_target, GL.TEXTURE_MIN_LOD, descriptor.lodMinClamp);
    // }
    // if (descriptor.lodMaxClamp !== undefined) {
    //   gl.texParameterf(gl_target, GL.TEXTURE_MAX_LOD, descriptor.lodMaxClamp);
    // }

    const maxAnisotropy = descriptor.maxAnisotropy ?? 1;
    if (
      maxAnisotropy > 1 &&
      this.device.EXT_texture_filter_anisotropic !== null
    ) {
      assert(
        descriptor.minFilter === FilterMode.BILINEAR &&
          descriptor.magFilter === FilterMode.BILINEAR &&
          descriptor.mipmapFilter === MipmapFilterMode.LINEAR,
      );
      gl.texParameteri(
        gl_target,
        this.device.EXT_texture_filter_anisotropic.TEXTURE_MAX_ANISOTROPY_EXT,
        maxAnisotropy,
      );
    }
  }

  destroy() {
    super.destroy();

    if (isWebGL2(this.device.gl)) {
      this.device.gl.deleteSampler(getPlatformSampler(this));
    }
  }

  isNPOT(width: number, height: number): boolean {
    return !isPowerOfTwo(width) || !isPowerOfTwo(height);
  }
}
