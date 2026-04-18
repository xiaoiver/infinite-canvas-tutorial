import { Format, Texture, TextureDescriptor, TextureDimension } from '../api';
import { ResourceType } from '../api';
import type { IDevice_WebGPU, TextureShared_WebGPU } from './interfaces';
import { ResourceBase_WebGPU } from './ResourceBase';
import {
  getBlockInformationFromFormat,
  translateTextureViewDimension,
} from './utils';
import { Device_WebGPU } from './Device';

export class Texture_WebGPU
  extends ResourceBase_WebGPU
  implements TextureShared_WebGPU, Texture
{
  type: ResourceType.Texture = ResourceType.Texture;
  format: Format;
  dimension: TextureDimension;
  gpuTextureformat: GPUTextureFormat;
  width: number;
  height: number;
  depthOrArrayLayers: number;
  mipLevelCount: number;
  sampleCount: number;
  usage: GPUTextureUsageFlags;
  gpuTexture: GPUTexture;
  gpuTextureView: GPUTextureView;
  private flipY = false;

  constructor({
    id,
    device,
    descriptor,
    skipCreate,
    sampleCount,
  }: {
    id: number;
    device: IDevice_WebGPU;
    descriptor: TextureDescriptor;
    skipCreate?: boolean;
    sampleCount?: number;
  }) {
    super({ id, device });

    const {
      format,
      dimension,
      width,
      height,
      depthOrArrayLayers,
      mipLevelCount,
      usage,
      pixelStore,
    } = descriptor;

    this.flipY = !!pixelStore?.unpackFlipY;

    this.device.createTextureShared(
      {
        format,
        dimension: dimension ?? TextureDimension.TEXTURE_2D,
        width,
        height,
        depthOrArrayLayers: depthOrArrayLayers ?? 1,
        mipLevelCount: mipLevelCount ?? 1,
        usage,
        sampleCount: sampleCount ?? 1,
      },
      this,
      skipCreate,
    );
  }

  private textureFromImageBitmapOrCanvas(
    device: GPUDevice,
    sources: (ImageBitmap | HTMLCanvasElement | OffscreenCanvas)[],
    depthOrArrayLayers: number,
  ): [GPUTexture, number, number] {
    const width = sources[0].width;
    const height = sources[0].height;
    const textureDescriptor: GPUTextureDescriptor = {
      // Unlike in WebGL, the size of our texture must be set at texture creation time.
      // This means we have to wait until the image is loaded to create the texture, since we won't
      // know the size until then.
      size: { width, height, depthOrArrayLayers },
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
      mipLevelCount: this.mipLevelCount,
    };
    const texture = device.createTexture(textureDescriptor);

    for (let i = 0; i < sources.length; i++) {
      device.queue.copyExternalImageToTexture(
        { source: sources[i], flipY: this.flipY },
        { texture, origin: [0, 0, i] },
        [width, height],
      );
    }

    if(this.mipLevelCount > 1) {
      (this.device as Device_WebGPU).getMipmapGenerator().generateMipmap(texture);
    }

    return [texture, width, height];
  }

  private isImageBitmapOrCanvases(
    datas: (TexImageSource | BufferSource)[],
  ): datas is (ImageBitmap | HTMLCanvasElement | OffscreenCanvas)[] {
    const data = datas[0];
    return (
      data instanceof ImageBitmap ||
      data instanceof HTMLCanvasElement ||
      data instanceof OffscreenCanvas
    );
  }

  private isVideo(
    datas: (TexImageSource | BufferSource)[],
  ): datas is HTMLVideoElement[] {
    const data = datas[0];
    return data instanceof HTMLVideoElement;
  }

  /**
   * @see https://toji.dev/webgpu-best-practices/img-textures
   */
  setImageData(datas: (TexImageSource | BufferSource)[], lod = 0) {
    const { device } = this.device;
    let texture: GPUTexture;
    let width: number;
    let height: number;

    if (this.isImageBitmapOrCanvases(datas)) {
      [texture, width, height] = this.textureFromImageBitmapOrCanvas(
        device,
        datas,
        this.depthOrArrayLayers,
      );
    } else if (this.isVideo(datas)) {
      // @see https://toji.dev/webgpu-best-practices/img-textures#creating-a-texture-from-an-htmlvideoelement-video-tag
      texture = device.importExternalTexture({
        source: datas[0],
      }) as unknown as GPUTexture;
    } else {
      const blockInformation = getBlockInformationFromFormat(
        this.gpuTextureformat,
      );
      const bytesPerRow =
        Math.ceil(this.width / blockInformation.width) *
        blockInformation.length;
      // TODO: support ArrayBufferView[]
      datas.forEach((data) => {
        device.queue.writeTexture(
          { texture: this.gpuTexture },
          data as BufferSource,
          {
            bytesPerRow,
          },
          {
            width: this.width,
            height: this.height,
          },
        );
      });
    }

    this.width = width;
    this.height = height;
    if (texture) {
      this.gpuTexture = texture;
    }
    this.gpuTextureView = this.gpuTexture.createView({
      dimension: translateTextureViewDimension(this.dimension),
    });
  }

  destroy() {
    super.destroy();
    // @see https://www.w3.org/TR/webgpu/#dom-gputexture-destroy
    this.gpuTexture.destroy();
  }
}
