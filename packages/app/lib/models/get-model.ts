/**
 * 统一的模型获取函数
 * 根据用户 ID 和能力类型，返回配置好的模型实例
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createFal } from '@ai-sdk/fal';
import { getUserCapabilityPreference } from '@/lib/db/user-preferences';
import { getUserProviderKeys } from '@/lib/db/user-preferences';
import type { Capability } from './capabilities';
import { ImageModel, LanguageModel, createGateway } from 'ai';

export type ModelInfo = {
  provider: string;
  model: string;
  apiKey: string;
  config?: Record<string, any>;
};

/**
 * 获取用户为指定能力配置的模型信息
 */
export async function getModelForCapability(
  userId: string,
  capability: Capability
): Promise<ModelInfo | null> {
  // 获取用户的能力偏好
  const preference = await getUserCapabilityPreference(userId, capability);

  if (!preference) {
    return null;
  }

  // 获取 API Key
  let apiKey: string | null = null;

  if (preference.providerKeyId) {
    // 如果指定了 providerKeyId，使用该 key
    const keys = await getUserProviderKeys(userId);
    const key = keys.find((k) => k.id === preference.providerKeyId);
    if (key) {
      // TODO: 在实际应用中，这里应该解密 API key
      // 目前假设 apiKeyEncrypted 就是 API key（未加密）
      apiKey = key.apiKeyEncrypted;
    }
  } else {
    // 如果没有指定 providerKeyId，使用该 provider 的默认 key
    const keys = await getUserProviderKeys(userId);
    const defaultKey = keys.find(
      (k) => k.provider === preference.provider
    );
    if (defaultKey) {
      apiKey = defaultKey.apiKeyEncrypted;
    }
  }

  if (!apiKey) {
    return null;
  }

  return {
    provider: preference.provider,
    model: preference.model,
    apiKey,
    config: preference.config as Record<string, any> | undefined,
  };
}

/**
 * 获取用户为指定能力配置的模型字符串（用于 AI SDK）
 * 格式：provider/model
 */
export async function getModelStringForCapability(
  userId: string,
  capability: Capability
): Promise<string | null> {
  const modelInfo = await getModelForCapability(userId, capability);
  if (!modelInfo) {
    return null;
  }
  return modelInfo.model; // model 已经是 'provider/model' 格式
}

export function createLanguageModel(modelInfo: ModelInfo): LanguageModel | undefined {
  const { provider, model, apiKey } = modelInfo;
  let languageModel: LanguageModel | undefined;
  if (provider === 'gateway') {
    const gateway = createGateway({
      apiKey,
    });
    languageModel = gateway(model);
  } else if (provider === 'openai') {
    const openai = createOpenAI({
      apiKey,
    });
    languageModel = openai(model);
  } else if (provider === 'google') {
    const google = createGoogleGenerativeAI({
      apiKey,
    });
    languageModel = google(model);
  }
  return languageModel;
}

export function createImageModel(modelInfo: ModelInfo): ImageModel | undefined {
  const { provider, model, apiKey } = modelInfo;
  let imageModel: ImageModel | undefined;
  if (provider === 'gateway') {
    const gateway = createGateway({
      apiKey,
    });
    imageModel = gateway.imageModel(model);
  } else if (provider === 'openai') {
    const openai = createOpenAI({
      apiKey,
    });
    imageModel = openai.imageModel(model);
  } else if (provider === 'google') {
    const google = createGoogleGenerativeAI({
      apiKey,
    });
    imageModel = google.imageModel(model);
  } else if (provider === 'fal') {
    const falProvider = createFal({
      apiKey,
    });
    imageModel = falProvider.image(model);
  }
  return imageModel;
}
