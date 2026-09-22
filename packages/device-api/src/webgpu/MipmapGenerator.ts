export class MipmapGenerator {
  private readonly _device: GPUDevice;
  private readonly _mipmapShader: GPUShaderModule;
  private readonly _mipmapSampler: GPUSampler;
  private readonly _pipelines: Map<GPUTextureFormat, GPURenderPipeline>;

  constructor(device: GPUDevice) {
    this._device = device;

    this._mipmapShader = this._device.createShaderModule({
      label: 'MipmapGenerator',
      code: `
      struct VSOutput {
        @builtin(position) position: vec4f,
        @location(0) texcoord: vec2f,
      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> VSOutput {
        let pos = array(
          // 1st triangle
          vec2f( 0.0,  0.0),  // center
          vec2f( 1.0,  0.0),  // right, center
          vec2f( 0.0,  1.0),  // center, top

          // 2nd triangle
          vec2f( 0.0,  1.0),  // center, top
          vec2f( 1.0,  0.0),  // right, center
          vec2f( 1.0,  1.0),  // right, top
        );

        var vsOutput: VSOutput;
        let xy = pos[vertexIndex];
        vsOutput.position = vec4f(xy * 2.0 - 1.0, 0.0, 1.0);
        vsOutput.texcoord = vec2f(xy.x, 1.0 - xy.y);
        return vsOutput;
      }

      @group(0) @binding(0) var ourSampler: sampler;
      @group(0) @binding(1) var ourTexture: texture_2d<f32>;

      @fragment fn fs(fsInput: VSOutput) -> @location(0) vec4f {
        return textureSample(ourTexture, ourSampler, fsInput.texcoord);
      }
      `,
    });
    this._mipmapSampler = this._device.createSampler({
      minFilter: 'linear',
    });
    this._pipelines = new Map();
  }

  private _requestPipeline(format: GPUTextureFormat) {
    let pipeline = this._pipelines.get(format);
    if (!pipeline) {
      pipeline = this._device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: this._mipmapShader,
          entryPoint: 'vs',
        },
        fragment: {
          module: this._mipmapShader,
          entryPoint: 'fs',
          targets: [{ format }],
        },
      });
      this._pipelines.set(format, pipeline);
    }
    return pipeline;
  }

  generateMipmap(texture: GPUTexture) {
    const commandEncoder = this._device.createCommandEncoder({
      label: 'mipmap generator command encoder',
    });
    const pipeline = this._requestPipeline(texture.format,);

    let width = texture.width;
    let height = texture.height;
    let baseMipLevel = 0;

    while ((width > 1 || height > 1) && baseMipLevel < texture.mipLevelCount - 1) {
      width = Math.max(1, width / 2);
      height = Math.max(1, height / 2);

      const bindGroup = this._device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: this._mipmapSampler,
          },
          {
            binding: 1,
            resource: texture.createView({
              baseMipLevel,
              mipLevelCount: 1,
            }),
          },
        ],
      });

      ++baseMipLevel;

      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: texture.createView({
              baseMipLevel,
              mipLevelCount: 1,
            }),
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(6);
      pass.end();
    }

    this._device.queue.submit([commandEncoder.finish()]);
  }
}
