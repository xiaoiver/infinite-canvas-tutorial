import type { framePhaseProbe } from './frame-phase-probe';
export type CameraPhaseProbe = ReturnType<typeof framePhaseProbe>;
export type CameraStage = readonly [object, string, string, string?];

/** Diagnostic-only scopes. Native durations are synchronous call wall time, not GPU time. */
export function installCameraPhases(
  probe: CameraPhaseProbe,
  canvas: HTMLCanvasElement,
  stages: readonly CameraStage[],
) {
  try {
    for (const [target, method, label, within] of stages)
      probe.wrap(target, method, label, within);
    // Call only after the renderer has initialized its WebGL context.
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl)
      throw new Error(
        'Camera phase diagnostics require an initialized WebGL context',
      );
    const groups = {
      buffer: [
        'createBuffer',
        'deleteBuffer',
        'bindBuffer',
        'bindBufferBase',
        'bindBufferRange',
        'bufferData',
        'bufferSubData',
        'copyBufferSubData',
      ],
      draw: [
        'drawArrays',
        'drawElements',
        'drawArraysInstanced',
        'drawElementsInstanced',
      ],
      uniform: [
        'uniform1f',
        'uniform1i',
        'uniform2f',
        'uniform3f',
        'uniform4f',
        'uniform1fv',
        'uniform2fv',
        'uniform3fv',
        'uniform4fv',
        'uniformMatrix3fv',
        'uniformMatrix4fv',
      ],
      shader: [
        'createShader',
        'shaderSource',
        'compileShader',
        'getShaderParameter',
        'createProgram',
        'attachShader',
        'linkProgram',
        'getProgramParameter',
        'getAttribLocation',
        'getUniformLocation',
      ],
      state: [
        'useProgram',
        'bindVertexArray',
        'enableVertexAttribArray',
        'disableVertexAttribArray',
        'vertexAttribPointer',
        'vertexAttribDivisor',
        'enable',
        'disable',
        'blendFuncSeparate',
        'blendEquationSeparate',
        'depthFunc',
        'depthMask',
        'viewport',
        'scissor',
      ],
      texture: [
        'activeTexture',
        'bindTexture',
        'texImage2D',
        'texSubImage2D',
        'texParameteri',
        'createTexture',
        'deleteTexture',
      ],
      pass: [
        'bindFramebuffer',
        'framebufferTexture2D',
        'clear',
        'clearColor',
        'blitFramebuffer',
      ],
    };
    const methods = gl as unknown as Record<string, unknown>;
    for (const [label, names] of Object.entries(groups))
      for (const name of names)
        if (typeof methods[name] === 'function')
          probe.wrap(gl, name, `native.${label}`);
  } catch (error) {
    probe.dispose();
    throw error;
  }
}
