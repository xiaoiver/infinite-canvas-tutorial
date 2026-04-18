import type { Buffer, Bindings, ComputePass, ComputePipeline } from '../api';
// import { assert, assertExists } from '../api';
// import type { ComputePipeline_GL } from './ComputePipeline';

export class ComputePass_GL implements ComputePass {
  /**
   * @see https://www.w3.org/TR/webgpu/#dom-gpucomputepassencoder-dispatch
   */
  dispatchWorkgroups(
    workgroupCountX: number,
    workgroupCountY?: number,
    workgroupCountZ?: number,
  ) {}

  dispatchWorkgroupsIndirect(indirectBuffer: Buffer, indirectOffset: number) {}

  setPipeline(pipeline_: ComputePipeline): void {
    // const pipeline = pipeline_ as ComputePipeline_WebGPU;
    // const gpuComputePipeline = assertExists(pipeline.gpuComputePipeline);
    // this.gpuComputePassEncoder.setPipeline(gpuComputePipeline);
  }

  setBindings(bindings_: Bindings): void {
    // const bindings = bindings_ as Bindings_WebGPU;
    // this.gpuComputePassEncoder.setBindGroup(bindingLayoutIndex, bindings.gpuBindGroup[0]);
  }

  pushDebugGroup(name: string) {}
  popDebugGroup() {}
  insertDebugMarker(markerLabel: string) {}
}
