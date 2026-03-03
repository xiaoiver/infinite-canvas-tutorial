/**
 * 标记「本帧由 Yoga updateCameraLayout 更新过」的实体，
 * 用于在 bounds.addedOrChanged 时跳过这些实体，避免 updateCameraLayout → bounds 变化 → 再次 layout 的反馈循环。
 */
export class YogaLayoutApplied {}
