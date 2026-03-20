/* tslint:disable */
/* eslint-disable */

export function addEllipse(canvas_id: number, opts: any): void;

export function addGroup(canvas_id: number, opts: any): void;

export function addImageRect(canvas_id: number, opts: any): void;

export function addLine(canvas_id: number, opts: any): void;

export function addPath(canvas_id: number, opts: any): void;

export function addPolyline(canvas_id: number, opts: any): void;

export function addRect(canvas_id: number, opts: any): void;

export function addRoughEllipse(canvas_id: number, opts: any): void;

export function addRoughLine(canvas_id: number, opts: any): void;

export function addRoughPath(canvas_id: number, opts: any): void;

export function addRoughPolyline(canvas_id: number, opts: any): void;

export function addRoughRect(canvas_id: number, opts: any): void;

export function addText(canvas_id: number, opts: any): void;

export function clearAllCaches(): void;

export function clearEmojiCache(): void;

export function clearGlyphCache(): void;

export function clearShapes(canvas_id: number): void;

export function computePathBounds(opts: any): any;

export function computeTextBounds(opts: any): any;

export function hitTestPath(opts: any): boolean;

export function measureFont(opts: any): any;

export function registerFont(js_value: any): void;

export function restoreCanvasAfterExport(canvas_id: number): void;

export function runWithCanvas(canvas: any, on_ready: any): void;

export function setCameraTransform(canvas_id: number, opts: any): void;

export function setCanvasRenderOptions(canvas_id: number, opts: any): void;

export function setExportView(canvas_id: number, opts: any, on_rendered: any): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly addEllipse: (a: number, b: any) => void;
    readonly addGroup: (a: number, b: any) => void;
    readonly addImageRect: (a: number, b: any) => void;
    readonly addLine: (a: number, b: any) => void;
    readonly addPath: (a: number, b: any) => void;
    readonly addPolyline: (a: number, b: any) => void;
    readonly addRect: (a: number, b: any) => void;
    readonly addRoughEllipse: (a: number, b: any) => void;
    readonly addRoughLine: (a: number, b: any) => void;
    readonly addRoughPath: (a: number, b: any) => void;
    readonly addRoughPolyline: (a: number, b: any) => void;
    readonly addRoughRect: (a: number, b: any) => void;
    readonly addText: (a: number, b: any) => void;
    readonly computePathBounds: (a: any) => any;
    readonly computeTextBounds: (a: any) => any;
    readonly hitTestPath: (a: any) => number;
    readonly measureFont: (a: any) => any;
    readonly registerFont: (a: any) => void;
    readonly restoreCanvasAfterExport: (a: number) => void;
    readonly runWithCanvas: (a: any, b: any) => void;
    readonly setCameraTransform: (a: number, b: any) => void;
    readonly setCanvasRenderOptions: (a: number, b: any) => void;
    readonly setExportView: (a: number, b: any, c: any) => void;
    readonly clearEmojiCache: () => void;
    readonly clearGlyphCache: () => void;
    readonly clearShapes: (a: number) => void;
    readonly clearAllCaches: () => void;
    readonly wasm_bindgen__closure__destroy__h2393627b061c6390: (a: number, b: number) => void;
    readonly wasm_bindgen__closure__destroy__h5efe34e33761ee9b: (a: number, b: number) => void;
    readonly wasm_bindgen__closure__destroy__h50129e0239694893: (a: number, b: number) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h26ef4de1d2f17d97: (a: number, b: number, c: any, d: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__hcd95a0b94c308f8e: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_2: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_3: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_4: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_5: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_6: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_7: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h07b4cad2128613da_8: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h5ba874b0856b22eb: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h0545557df07585f9: (a: number, b: number) => void;
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
