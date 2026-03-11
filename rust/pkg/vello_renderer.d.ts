/* tslint:disable */
/* eslint-disable */

/**
 * 添加圆形。
 */
export function addCircle(canvas_id: number, opts: any): void;

/**
 * 添加线段。
 */
export function addLine(canvas_id: number, opts: any): void;

/**
 * 添加矩形。canvas_id 由 runWithCanvas 的 onReady 回调传入；opts 同前。
 */
export function addRect(canvas_id: number, opts: any): void;

/**
 * 添加文本。
 */
export function addText(canvas_id: number, opts: any): void;

/**
 * 清空指定画布上由 JS 添加的所有图形。
 */
export function clearShapes(canvas_id: number): void;

/**
 * 注册默认字体（TTF/OTF 字节）。用于 addText 渲染；传入 Uint8Array 或 ArrayBuffer。
 */
export function registerDefaultFont(js_value: any): void;

/**
 * 使用传入的 canvas 元素启动渲染。onReady(canvasId) 在画布就绪时调用，后续 addRect/addCircle 等需传入该 canvasId。
 */
export function runWithCanvas(canvas: any, on_ready: any): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly addCircle: (a: number, b: any) => void;
    readonly addLine: (a: number, b: any) => void;
    readonly addRect: (a: number, b: any) => void;
    readonly addText: (a: number, b: any) => void;
    readonly registerDefaultFont: (a: any) => void;
    readonly runWithCanvas: (a: any, b: any) => void;
    readonly clearShapes: (a: number) => void;
    readonly wasm_bindgen__closure__destroy__h4c4fcff17bc9837f: (a: number, b: number) => void;
    readonly wasm_bindgen__closure__destroy__h3d33b15ab84bb1d2: (a: number, b: number) => void;
    readonly wasm_bindgen__closure__destroy__h50129e0239694893: (a: number, b: number) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h3cf9993aa40a3601: (a: number, b: number, c: any, d: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__hcd95a0b94c308f8e: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen__convert__closures_____invoke__h02d8f1fff670202e: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h02d8f1fff670202e_2: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h02d8f1fff670202e_3: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h02d8f1fff670202e_4: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h02d8f1fff670202e_5: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h02d8f1fff670202e_6: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h02d8f1fff670202e_7: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h02d8f1fff670202e_8: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h4c82f214f856c24f: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h32bdbf5415e5a149: (a: number, b: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
