/**
 * 能力（Capability）类型定义
 * 对齐 AI SDK 的能力抽象
 */
export type Capability =
  | 'text'        // generateText / streamText
  | 'chat'        // chat / UIMessage
  | 'image'      // generateImage
  | 'image-layered' // decomposeImage
  | 'vectorize'; // vectorizeImage
// | 'embedding'   // embeddings

/**
 * 能力配置接口
 */
export interface CapabilityConfig {
  capability: Capability;
  provider: string;
  model: string;
  providerKeyId?: string | null;
  config?: Record<string, any>;
}

/**
 * 所有支持的能力列表
 */
export const ALL_CAPABILITIES: Capability[] = [
  'text',
  'chat',
  'image',
  'image-layered',
  'vectorize',
  // 'embedding',
];

/**
 * 验证 capability 是否有效
 */
export function isValidCapability(value: string): value is Capability {
  return ALL_CAPABILITIES.includes(value as Capability);
}

