import {
  Format,
  FormatTypeFlags,
  GL,
  ResourceType,
  SamplerFormatKind,
  Texture,
  TextureDescriptor,
  TextureDimension,
  TextureUsage,
  assert,
  getFormatSamplerKind,
  getFormatTypeFlags,
  isPowerOfTwo,
  isTypedArray,
} from '../api';
import type { Device_GL } from './Device';
import { ResourceBase_GL } from './ResourceBase';
import {
  getPlatformTexture,
  isTextureFormatCompressed,
  // isTextureFormatCompressed,
  isWebGL2,
} from './utils';

export class Texture_GL extends ResourceBase_GL implements Texture {
  type: ResourceType.Texture = ResourceType.Texture;
  gl_texture: WebGLTexture;
  gl_target: GLenum;
  format: Format;
  dimension: TextureDimension;
  width: number;
  height: number;
  depthOrArrayLayers: number;
  mipLevelCount: number;
  immutable: boolean;
  // @see https://developer.mozilla.org/zh-CN/docs/Web/API/WebGLRenderingContext/pixelStorei
  pixelStore: Partial<{
    packAlignment: number;
    unpackAlignment: number;
    unpackFlipY: boolean;
  }>;
  mipmaps: boolean;
  formatKind: SamplerFormatKind;
  textureIndex: number; // used in WebGL1

  constructor({
    id,
    device,
    descriptor,
    fake,
  }: {
    id: number;
    device: Device_GL;
    descriptor: TextureDescriptor;
    fake?: boolean;
  }) {
    super({ id, device });

    // Default values.
    descriptor = {
      dimension: TextureDimension.TEXTURE_2D,
      depthOrArrayLayers: 1,
      mipLevelCount: 1,
      ...descriptor,
    };

    const gl = this.device.gl;
    let gl_target: GLenum;
    let gl_texture: WebGLTexture;
    const mipLevelCount = this.clampmipLevelCount(descriptor);
    this.immutable = descriptor.usage === TextureUsage.RENDER_TARGET;
    this.pixelStore = descriptor.pixelStore;
    this.format = descriptor.format;
    this.dimension = descriptor.dimension;
    this.formatKind = getFormatSamplerKind(descriptor.format);
    this.width = descriptor.width;
    this.height = descriptor.height;
    this.depthOrArrayLayers = descriptor.depthOrArrayLayers;
    this.mipmaps = mipLevelCount >= 1;

    if (!fake) {
      gl_texture = this.device.ensureResourceExists(gl.createTexture());
      const gl_type = this.device.translateTextureType(descriptor.format);

      const internalformat = this.device.translateTextureInternalFormat(
        descriptor.format,
      );
      this.device.setActiveTexture(gl.TEXTURE0);
      this.device['currentTextures'][0] = null;

      this.preprocessImage();

      if (descriptor.dimension === TextureDimension.TEXTURE_2D) {
        gl_target = GL.TEXTURE_2D;
        gl.bindTexture(gl_target, gl_texture);
        if (this.immutable) {
          if (isWebGL2(gl)) {
            // texStorage2D will create an immutable texture(fixed size)
            // @see https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/texStorage2D
            // @see https://github.com/visgl/luma.gl/issues/193
            // @see https://github.com/WebGLSamples/WebGL2Samples/blob/master/samples/texture_immutable.html
            gl.texStorage2D(
              gl_target,
              mipLevelCount,
              internalformat,
              descriptor.width,
              descriptor.height,
            );
          } else {
            // texImage2D: level must be 0 for DEPTH_COMPONENT format
            // const level = internalformat === GL.DEPTH_COMPONENT || this.isNPOT() ? 0 : mipLevelCount;
            const level =
              internalformat === GL.DEPTH_COMPONENT || this.isNPOT() ? 0 : 0;

            if (
              (this.format === Format.D32F || this.format === Format.D24_S8) &&
              !isWebGL2(gl) &&
              !device.WEBGL_depth_texture
            ) {
            } else {
              // if (!isWebGL2(gl)) {
              //   if (internalformat === GL.RGBA4) {
              //     internalformat = GL.RGBA;
              //   }
              // }
              // @see https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texImage2D
              gl.texImage2D(
                gl_target,
                level,
                internalformat,
                descriptor.width,
                descriptor.height,
                0,
                internalformat,
                gl_type,
                null,
              );

              // @see https://stackoverflow.com/questions/21954036/dartweb-gl-render-warning-texture-bound-to-texture-unit-0-is-not-renderable
              // [.WebGL-0x106ad0400]RENDER WARNING: texture bound to texture unit 0 is not renderable. It might be non-power-of-2 or have incompatible texture filtering (maybe)?
              if (this.mipmaps) {
                this.mipmaps = false;
                gl.texParameteri(
                  GL.TEXTURE_2D,
                  GL.TEXTURE_MIN_FILTER,
                  GL.LINEAR,
                );
                gl.texParameteri(
                  GL.TEXTURE_2D,
                  GL.TEXTURE_WRAP_S,
                  GL.CLAMP_TO_EDGE,
                );
                gl.texParameteri(
                  GL.TEXTURE_2D,
                  GL.TEXTURE_WRAP_T,
                  GL.CLAMP_TO_EDGE,
                );
              }
            }
          }
        }

        assert(descriptor.depthOrArrayLayers === 1);
      } else if (descriptor.dimension === TextureDimension.TEXTURE_2D_ARRAY) {
        gl_target = GL.TEXTURE_2D_ARRAY;
        gl.bindTexture(gl_target, gl_texture);
        if (this.immutable) {
          if (isWebGL2(gl)) {
            // @see https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/texStorage3D
            gl.texStorage3D(
              gl_target,
              mipLevelCount,
              internalformat,
              descriptor.width,
              descriptor.height,
              descriptor.depthOrArrayLayers,
            );
          }
        }
      } else if (descriptor.dimension === TextureDimension.TEXTURE_3D) {
        gl_target = GL.TEXTURE_3D;
        gl.bindTexture(gl_target, gl_texture);
        if (this.immutable) {
          if (isWebGL2(gl)) {
            gl.texStorage3D(
              gl_target,
              mipLevelCount,
              internalformat,
              descriptor.width,
              descriptor.height,
              descriptor.depthOrArrayLayers,
            );
          }
        }
      } else if (descriptor.dimension === TextureDimension.TEXTURE_CUBE_MAP) {
        gl_target = GL.TEXTURE_CUBE_MAP;
        gl.bindTexture(gl_target, gl_texture);
        if (this.immutable) {
          if (isWebGL2(gl)) {
            gl.texStorage2D(
              gl_target,
              mipLevelCount,
              internalformat,
              descriptor.width,
              descriptor.height,
            );
          }
        }
        assert(descriptor.depthOrArrayLayers === 6);
      } else {
        throw new Error('whoops');
      }
    }

    this.gl_texture = gl_texture;
    this.gl_target = gl_target;
    this.mipLevelCount = mipLevelCount;
  }

  setImageData(levelDatas: (TexImageSource | ArrayBufferView)[], lod = 0) {
    const gl = this.device.gl;
    const isCompressed = isTextureFormatCompressed(this.format);
    // @see https://github.com/shrekshao/MoveWebGL1EngineToWebGL2/blob/master/Move-a-WebGL-1-Engine-To-WebGL-2-Blog-2.md#3d-texture
    const is3D =
      this.gl_target === GL.TEXTURE_3D ||
      this.gl_target === GL.TEXTURE_2D_ARRAY;
    const isCube = this.gl_target === GL.TEXTURE_CUBE_MAP;
    const isTA = isTypedArray(levelDatas[0]);

    this.device.setActiveTexture(gl.TEXTURE0);
    this.device['currentTextures'][0] = null;

    const data = levelDatas[0];

    let width: number;
    let height: number;
    if (isTA) {
      width = this.width;
      height = this.height;
    } else {
      // FIXME: Property 'width' does not exist on type 'TexImageSource'.
      // Property 'width' does not exist on type 'VideoFrame'.
      // @ts-ignore
      width = (data as TexImageSource).width;
      // @ts-ignore
      height = (data as TexImageSource).height;
      // update size
      this.width = width;
      this.height = height;
    }

    gl.bindTexture(this.gl_target, this.gl_texture);

    const gl_format = this.device.translateTextureFormat(this.format);
    // In WebGL 1, this must be the same as internalformat
    const gl_internal_format = isWebGL2(gl)
      ? this.device.translateInternalTextureFormat(this.format)
      : gl_format;
    const gl_type = this.device.translateTextureType(this.format);

    this.preprocessImage();

    for (let z = 0; z < this.depthOrArrayLayers; z++) {
      const levelData = levelDatas[z];
      let gl_target = this.gl_target;

      if (isCube) {
        gl_target = GL.TEXTURE_CUBE_MAP_POSITIVE_X + (z % 6);
      }

      if (this.immutable) {
        if (isCompressed) {
          // TODO: gl.compressedTexSubImage2D()
        }
        // must use texSubImage2D instead of texImage2D, since texture is immutable
        // @see https://stackoverflow.com/questions/56123201/unity-plugin-texture-is-immutable?rq=1
        // @see https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texSubImage2D
        gl.texSubImage2D(
          gl_target,
          lod,
          0,
          0,
          width,
          height,
          gl_format,
          gl_type,
          levelData as ArrayBufferView,
        );
      } else {
        if (isWebGL2(gl)) {
          if (is3D) {
            gl.texImage3D(
              gl_target,
              lod,
              gl_internal_format,
              width,
              height,
              this.depthOrArrayLayers,
              0, // border must be 0
              gl_format, // TODO: can be different with gl_format
              gl_type,
              levelData as ArrayBufferView,
            );
          } else {
            // @see https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texImage2D
            gl.texImage2D(
              gl_target,
              lod,
              gl_internal_format,
              width,
              height,
              0, // border must be 0
              gl_format, // TODO: can be different with gl_format
              gl_type,
              levelData as ArrayBufferView,
            );
          }
        } else {
          // WebGL1: upload Array & Image separately
          if (isTA) {
            (gl as WebGLRenderingContext).texImage2D(
              gl_target,
              lod,
              gl_format,
              width,
              height,
              0,
              gl_format,
              gl_type,
              levelData as ArrayBufferView,
            );
          } else {
            (gl as WebGLRenderingContext).texImage2D(
              gl_target,
              lod,
              gl_format,
              gl_format,
              gl_type,
              levelData as TexImageSource,
            );
          }
        }
      }
    }

    if (this.mipmaps) {
      this.generateMipmap(is3D);
    }
  }

  destroy() {
    super.destroy();
    this.device.gl.deleteTexture(getPlatformTexture(this));
  }

  private clampmipLevelCount(descriptor: TextureDescriptor): number {
    if (
      descriptor.dimension === TextureDimension.TEXTURE_2D_ARRAY &&
      descriptor.depthOrArrayLayers > 1
    ) {
      const typeFlags: FormatTypeFlags = getFormatTypeFlags(descriptor.format);
      if (typeFlags === FormatTypeFlags.BC1) {
        // Chrome/ANGLE seems to have issues with compressed miplevels of size 1/2, so clamp before they arrive...
        // https://bugs.chromium.org/p/angleproject/issues/detail?id=4056
        let w = descriptor.width,
          h = descriptor.height;
        for (let i = 0; i < descriptor.mipLevelCount; i++) {
          if (w <= 2 || h <= 2) return i - 1;

          w = Math.max((w / 2) | 0, 1);
          h = Math.max((h / 2) | 0, 1);
        }
      }
    }

    return descriptor.mipLevelCount;
  }

  private preprocessImage() {
    const gl = this.device.gl;
    if (this.pixelStore) {
      if (this.pixelStore.unpackFlipY) {
        gl.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, true);
      }
      if (this.pixelStore.packAlignment) {
        gl.pixelStorei(GL.PACK_ALIGNMENT, this.pixelStore.packAlignment);
      }
      if (this.pixelStore.unpackAlignment) {
        gl.pixelStorei(GL.UNPACK_ALIGNMENT, this.pixelStore.unpackAlignment);
      }
    }
  }

  private generateMipmap(is3D = false): this {
    const gl = this.device.gl;
    if (!isWebGL2(gl) && this.isNPOT()) {
      return this;
    }

    if (this.gl_texture && this.gl_target) {
      gl.bindTexture(this.gl_target, this.gl_texture);

      if (is3D) {
        gl.texParameteri(this.gl_target, GL.TEXTURE_BASE_LEVEL, 0);
        gl.texParameteri(
          this.gl_target,
          GL.TEXTURE_MAX_LEVEL,
          Math.log2(this.width),
        );
        gl.texParameteri(
          this.gl_target,
          GL.TEXTURE_MIN_FILTER,
          GL.LINEAR_MIPMAP_LINEAR,
        );
        gl.texParameteri(this.gl_target, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
      } else {
        gl.texParameteri(
          GL.TEXTURE_2D,
          GL.TEXTURE_MIN_FILTER,
          GL.NEAREST_MIPMAP_LINEAR,
        );
      }

      gl.generateMipmap(this.gl_target);
      gl.bindTexture(this.gl_target, null);
    }
    return this;
  }

  private isNPOT(): boolean {
    const gl = this.device.gl;
    if (isWebGL2(gl)) {
      // NPOT restriction is only for WebGL1
      return false;
    }
    return !isPowerOfTwo(this.width) || !isPowerOfTwo(this.height);
  }
}
