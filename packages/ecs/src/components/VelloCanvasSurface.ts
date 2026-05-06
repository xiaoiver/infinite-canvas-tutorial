/**
 * 标记 Vello WASM 已为该 canvas 实体完成 surface 绑定。
 * Mesh 管线使用 {@link GPUResource}；纯 Vello 路径通常没有 GPUResource，由 InitVello 在 `runWithCanvas` 回调里挂上本标记。
 */
export class VelloCanvasSurface {}
