export async function checkWebGPUSupport() {
  if ('gpu' in navigator) {
    const gpu = await navigator.gpu.requestAdapter();
    if (!gpu) {
      throw new Error('No WebGPU adapter available.');
    }
  } else {
    throw new Error('WebGPU is not supported by the browser.');
  }
}
