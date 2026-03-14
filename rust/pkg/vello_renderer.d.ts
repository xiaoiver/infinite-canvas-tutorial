/* tslint:disable */
/* eslint-disable */

/**
 * 添加椭圆。
 */
export function addEllipse(canvas_id: number, opts: any): void;

/**
 * 添加组/容器。用于组织子元素，本身没有可见内容。
 */
export function addGroup(canvas_id: number, opts: any): void;

/**
 * 添加图片填充的矩形。opts 需包含 imageData (Uint8Array RGBA)、imageWidth、imageHeight。
 */
export function addImageRect(canvas_id: number, opts: any): void;

/**
 * 添加线段。
 */
export function addLine(canvas_id: number, opts: any): void;

/**
 * 添加 path。opts 需包含 d（SVG path 的 d 属性）。
 */
export function addPath(canvas_id: number, opts: any): void;

/**
 * 添加折线。opts 需包含 points（[[x,y],[x,y],...]）。
 */
export function addPolyline(canvas_id: number, opts: any): void;

/**
 * 添加矩形。canvas_id 由 runWithCanvas 的 onReady 回调传入；opts 同前。
 */
export function addRect(canvas_id: number, opts: any): void;

/**
 * 添加手绘风格椭圆。
 */
export function addRoughEllipse(canvas_id: number, opts: any): void;

/**
 * 添加手绘风格线段。
 */
export function addRoughLine(canvas_id: number, opts: any): void;

/**
 * 添加手绘风格矩形。
 */
export function addRoughRect(canvas_id: number, opts: any): void;

/**
 * 添加文本。
 */
export function addText(canvas_id: number, opts: any): void;

/**
 * 清空所有缓存（emoji + 字形）。在切换字体或内存紧张时调用。
 */
export function clearAllCaches(): void;

/**
 * 清空 emoji 缓存，释放内存。在切换字体或长时间运行后调用。
 */
export function clearEmojiCache(): void;

/**
 * 清空字形缓存，释放内存。在切换字体或长时间运行后调用。
 */
export function clearGlyphCache(): void;

/**
 * 清空指定画布上由 JS 添加的所有图形。
 */
export function clearShapes(canvas_id: number): void;

/**
 * 注册默认字体（TTF/OTF 字节）。用于 addText 渲染；传入 Uint8Array 或 ArrayBuffer。
 */
export function registerDefaultFont(js_value: any): void;

/**
 * 请求画布重绘。JS 在更新相机或图形后调用，以触发下一帧渲染。
 */
export function requestRedraw(canvas_id: number): void;

/**
 * 使用传入的 canvas 元素启动渲染。onReady(canvasId) 在画布就绪时调用，后续 addRect/addEllipse 等需传入该 canvasId。
 */
export function runWithCanvas(canvas: any, on_ready: any): void;

/**
 * 设置画布相机变换。opts 支持 { x, y, scale, rotation }，下一帧渲染前生效。
 * - x, y: 平移（世界坐标）
 * - scale: 缩放因子，1 为原始大小，2 为 2 倍放大
 * - rotation: 旋转弧度
 */
export function setCameraTransform(canvas_id: number, opts: any): void;

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
    readonly addRoughRect: (a: number, b: any) => void;
    readonly addText: (a: number, b: any) => void;
    readonly registerDefaultFont: (a: any) => void;
    readonly requestRedraw: (a: number) => void;
    readonly runWithCanvas: (a: any, b: any) => void;
    readonly setCameraTransform: (a: number, b: any) => void;
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
