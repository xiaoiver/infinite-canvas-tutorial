/* tslint:disable */
/* eslint-disable */
/**
* @param {string} source
* @param {string} stage
* @param {boolean} validation_enabled
* @returns {string}
*/
export function glsl_compile(source: string, stage: string, validation_enabled: boolean): string;
/**
*/
export class WGSLComposer {
  free(): void;
/**
*/
  constructor();
/**
* @param {string} source
*/
  load_composable(source: string): void;
/**
* @param {string} source
* @returns {string}
*/
  wgsl_compile(source: string): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_wgslcomposer_free: (a: number) => void;
  readonly wgslcomposer_new: () => number;
  readonly wgslcomposer_load_composable: (a: number, b: number, c: number) => void;
  readonly wgslcomposer_wgsl_compile: (a: number, b: number, c: number, d: number) => void;
  readonly glsl_compile: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
