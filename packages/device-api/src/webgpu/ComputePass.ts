import type { Buffer, Bindings, ComputePass, ComputePipeline } from '../api';
import { assert, assertExists } from '../api';
import type { Buffer_WebGPU } from './Buffer';
import type { Bindings_WebGPU } from './Bindings';
import type { ComputePipeline_WebGPU } from './ComputePipeline';

export class ComputePass_WebGPU implements ComputePass {
  frameCommandEncoder: GPUCommandEncoder | null;
  private gpuComputePassDescriptor: GPUComputePassDescriptor;
  private gpuComputePassEncoder: GPUComputePassEncoder | null = null;

  /**
   * @see https://www.w3.org/TR/webgpu/#dom-gpucomputepassencoder-dispatchworkgroups
   */
  dispatchWorkgroups(
    workgroupCountX: number,
    workgroupCountY?: number,
    workgroupCountZ?: number,
  ): void {
    this.gpuComputePassEncoder.dispatchWorkgroups(
      workgroupCountX,
      workgroupCountY,
      workgroupCountZ,
    );
  }

  /**
   * @see https://www.w3.org/TR/webgpu/#dom-gpucomputepassencoder-dispatchworkgroupsindirect
   */
  dispatchWorkgroupsIndirect(indirectBuffer: Buffer, indirectOffset: number) {
    this.gpuComputePassEncoder.dispatchWorkgroupsIndirect(
      (indirectBuffer as Buffer_WebGPU).gpuBuffer,
      indirectOffset,
    );
  }

  finish() {
    this.gpuComputePassEncoder.end();
    this.gpuComputePassEncoder = null;
    this.frameCommandEncoder = null;
  }

  /**
   * @see https://www.w3.org/TR/webgpu/#dom-gpucommandencoder-begincomputepass
   */
  beginComputePass(commandEncoder: GPUCommandEncoder): void {
    assert(this.gpuComputePassEncoder === null);
    this.frameCommandEncoder = commandEncoder;
    this.gpuComputePassEncoder = this.frameCommandEncoder.beginComputePass(
      this.gpuComputePassDescriptor,
    );
  }

  setPipeline(pipeline_: ComputePipeline): void {
    const pipeline = pipeline_ as ComputePipeline_WebGPU;
    const gpuComputePipeline = assertExists(pipeline.gpuComputePipeline);
    this.gpuComputePassEncoder.setPipeline(gpuComputePipeline);
  }

  setBindings(bindings_: Bindings): void {
    const bindings = bindings_ as Bindings_WebGPU;
    bindings.gpuBindGroup.forEach((gpuBindGroup, i) => {
      if (gpuBindGroup) {
        this.gpuComputePassEncoder.setBindGroup(i, bindings.gpuBindGroup[i]);
      }
    });
  }

  pushDebugGroup(name: string): void {
    this.gpuComputePassEncoder.pushDebugGroup(name);
  }

  popDebugGroup(): void {
    this.gpuComputePassEncoder.popDebugGroup();
  }

  insertDebugMarker(markerLabel: string) {
    this.gpuComputePassEncoder.insertDebugMarker(markerLabel);
  }
}
