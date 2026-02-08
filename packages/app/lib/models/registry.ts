/**
 * 模型注册表
 * 维护所有支持的 provider 和模型列表
 * 可以根据 AI SDK 文档更新：https://ai-sdk.dev/providers/ai-sdk-providers
 */

import type { Capability } from './capabilities';

export interface ModelInfo {
  value: string; // 格式：provider/model-name，如 'openai/gpt-4o'
  label: string; // 显示名称
  provider: string; // provider 名称，如 'openai'
  description?: string; // 模型描述（可选）
  capabilities: Capability[]; // 该模型支持的能力列表
}

export interface ProviderInfo {
  value: string;
  label: string;
  models: ModelInfo[];
}

/**
 * 支持的 Providers 列表
 */
export const PROVIDERS: ProviderInfo[] = [
  {
    value: 'gateway',
    label: 'AI Gateway',
    // @see https://vercel.com/ai-gateway/models
    models: [
      { value: 'openai/gpt-4o', label: 'GPT-4o', provider: 'gateway', capabilities: ['text', 'chat'] },
      { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', provider: 'gateway', capabilities: ['text', 'chat'] },
      { value: 'google/gemini-3-pro', label: 'Gemini 3 Pro', provider: 'gateway', capabilities: ['text', 'chat'] },
      { value: 'google/gemini-3-pro-image', label: 'Gemini 3 Pro Image', provider: 'gateway', capabilities: ['image'] },
      { value: 'google/gemini-3-flash', label: 'Gemini 3 Flash', provider: 'gateway', capabilities: ['text', 'chat'] },
      { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'gateway', capabilities: ['text', 'chat'] },
      { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gateway', capabilities: ['text', 'chat'] },
      { value: 'google/gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image', provider: 'gateway', capabilities: ['image'] },
    ],
  },
  {
    value: 'openai',
    label: 'OpenAI',
    models: [
      { value: 'openai/gpt-5.2-pro', label: 'GPT-5.2 Pro', provider: 'openai', capabilities: ['text', 'chat'] },
      { value: 'openai/gpt-5.2', label: 'GPT-5.2', provider: 'openai', capabilities: ['text', 'chat'] },
      { value: 'openai/gpt-5.1', label: 'GPT-5.1', provider: 'openai', capabilities: ['text', 'chat'] },
      { value: 'openai/gpt-5', label: 'GPT-5', provider: 'openai', capabilities: ['text', 'chat'] },
      { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini', provider: 'openai', capabilities: ['text', 'chat'] },
      { value: 'openai/gpt-4.1', label: 'GPT-4.1', provider: 'openai', capabilities: ['text', 'chat'] },
      { value: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'openai', capabilities: ['text', 'chat'] },
      { value: 'openai/gpt-4o', label: 'GPT-4o', provider: 'openai', capabilities: ['text', 'chat'] },
      { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai', capabilities: ['text', 'chat'] },
    ],
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    models: [
      { value: 'anthropic/claude-opus-4-5', label: 'Claude Opus 4.5', provider: 'anthropic', capabilities: ['text', 'chat'] },
      { value: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5', provider: 'anthropic', capabilities: ['text', 'chat'] },
      { value: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5', provider: 'anthropic', capabilities: ['text', 'chat'] },
      { value: 'anthropic/claude-opus-4-1', label: 'Claude Opus 4.1', provider: 'anthropic', capabilities: ['text', 'chat'] },
      { value: 'anthropic/claude-sonnet-4-0', label: 'Claude Sonnet 4.0', provider: 'anthropic', capabilities: ['text', 'chat'] },
    ],
  },
  {
    value: 'google',
    label: 'Google Generative AI',
    models: [
      { value: 'google/gemini-3-pro', label: 'Gemini 3 Pro', provider: 'google', capabilities: ['text', 'chat'] },
      { value: 'google/gemini-3-pro-image', label: 'Gemini 3 Pro Image', provider: 'google', capabilities: ['image'] },
      { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'google', capabilities: ['text', 'chat'] },
      { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'google', capabilities: ['text', 'chat'] },
      { value: 'google/gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image', provider: 'google', capabilities: ['image'] },
    ],
  },
  // {
  //     value: 'groq',
  //     label: 'Groq',
  //     models: [
  //         { value: 'groq/llama-3.1-70b-versatile', label: 'Llama 3.1 70B Versatile', provider: 'groq', capabilities: ['text', 'chat'] },
  //         { value: 'groq/llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', provider: 'groq', capabilities: ['text', 'chat'] },
  //         { value: 'groq/mixtral-8x7b-32768', label: 'Mixtral 8x7B', provider: 'groq', capabilities: ['text', 'chat'] },
  //     ],
  // },
  // {
  //     value: 'openrouter',
  //     label: 'OpenRouter',
  //     models: [
  //         { value: 'openrouter/openai/gpt-4o', label: 'GPT-4o (via OpenRouter)', provider: 'openrouter', capabilities: ['text', 'chat', 'vision'] },
  //         { value: 'openrouter/anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (via OpenRouter)', provider: 'openrouter', capabilities: ['text', 'chat', 'vision'] },
  //         { value: 'openrouter/google/gemini-pro', label: 'Gemini Pro (via OpenRouter)', provider: 'openrouter', capabilities: ['text', 'chat', 'vision'] },
  //     ],
  // },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    models: [
      { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1', provider: 'deepseek', capabilities: ['text', 'chat'] },
      { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat', provider: 'deepseek', capabilities: ['text', 'chat'] },
    ],
  },
  {
    value: 'fal',
    label: 'Fal.ai',
    models: [
      { value: 'fal-ai/qwen-image-layered', label: 'Qwen Image Layered', provider: 'fal', capabilities: ['image-layered'] },
    ],
  },
  // {
  //     value: 'perplexity',
  //     label: 'Perplexity',
  //     models: [
  //         { value: 'perplexity/sonar', label: 'Perplexity Sonar', provider: 'perplexity', capabilities: ['text', 'chat'] },
  //         { value: 'perplexity/sonar-pro', label: 'Perplexity Sonar Pro', provider: 'perplexity', capabilities: ['text', 'chat'] },
  //     ],
  // },
  // {
  //     value: 'mistral',
  //     label: 'Mistral AI',
  //     models: [
  //         { value: 'mistral/mistral-large-latest', label: 'Mistral Large', provider: 'mistral', capabilities: ['text', 'chat'] },
  //         { value: 'mistral/mistral-medium-latest', label: 'Mistral Medium', provider: 'mistral', capabilities: ['text', 'chat'] },
  //         { value: 'mistral/mistral-small-latest', label: 'Mistral Small', provider: 'mistral', capabilities: ['text', 'chat'] },
  //     ],
  // },
  // {
  //     value: 'xai',
  //     label: 'xAI Grok',
  //     models: [
  //         { value: 'xai/grok-4-fast-reasoning', label: 'Grok 4 Fast Reasoning', provider: 'xai', capabilities: ['text', 'chat', 'vision'] },
  //         { value: 'xai/grok-4', label: 'Grok 4', provider: 'xai', capabilities: ['text', 'chat', 'vision'] },
  //         { value: 'xai/grok-3', label: 'Grok 3', provider: 'xai', capabilities: ['text', 'chat'] },
  //         { value: 'xai/grok-3-fast', label: 'Grok 3 Fast', provider: 'xai', capabilities: ['text', 'chat'] },
  //         { value: 'xai/grok-3-mini', label: 'Grok 3 Mini', provider: 'xai', capabilities: ['text', 'chat'] },
  //         { value: 'xai/grok-2-vision-1212', label: 'Grok 2 Vision', provider: 'xai', capabilities: ['text', 'chat', 'vision'] },
  //     ],
  // },
];

/**
 * 获取所有模型列表（扁平化）
 */
export function getAllModels(): ModelInfo[] {
  return PROVIDERS.flatMap((provider) => provider.models);
}

/**
 * 根据 provider 获取模型列表
 */
export function getModelsByProvider(provider: string): ModelInfo[] {
  const providerInfo = PROVIDERS.find((p) => p.value === provider);
  return providerInfo?.models || [];
}

/**
 * 根据已配置的 providers 获取可用模型列表
 */
export function getAvailableModels(configuredProviders: string[]): ModelInfo[] {
  if (configuredProviders.length === 0) {
    return getAllModels(); // 如果没有配置，返回所有模型
  }

  return PROVIDERS
    .filter((p) => configuredProviders.includes(p.value))
    .flatMap((p) => p.models);
}

/**
 * 根据 capability 过滤模型列表
 */
export function getModelsByCapability(
  models: ModelInfo[],
  capability: Capability
): ModelInfo[] {
  return models.filter((model) => model.capabilities.includes(capability));
}

/**
 * 根据已配置的 providers 和 capability 获取可用模型列表
 */
export function getAvailableModelsByCapability(
  configuredProviders: string[],
  capability: Capability
): ModelInfo[] {
  const availableModels = getAvailableModels(configuredProviders);
  return getModelsByCapability(availableModels, capability);
}

/**
 * 获取所有 providers 列表
 */
export function getAllProviders(): Array<{ value: string; label: string }> {
  return PROVIDERS.map((p) => ({ value: p.value, label: p.label }));
}

/**
 * 根据模型值查找模型信息
 */
export function findModelByValue(modelValue: string): ModelInfo | undefined {
  return getAllModels().find((m) => m.value === modelValue);
}

