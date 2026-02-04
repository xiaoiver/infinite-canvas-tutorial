import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  getAllModels,
  getModelsByProvider,
  getAvailableModels,
  getAvailableModelsByCapability,
  getAllProviders,
  type ModelInfo,
} from '@/lib/models/registry';
import { Capability, isValidCapability } from '@/lib/models/capabilities';
import { getUserProviderKeys } from '@/lib/db/user-preferences';

/**
 * GET /api/models
 * 获取可用模型列表
 * 
 * 查询参数：
 * - provider: 可选，指定 provider 获取该 provider 的模型
 * - userOnly: 可选，如果为 'true'，只返回用户已配置 provider 的模型
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider');
    const capability = searchParams.get('capability');
    const userOnly = searchParams.get('userOnly') === 'true';

    // 验证 capability 参数
    if (capability && !isValidCapability(capability)) {
      return NextResponse.json(
        { error: 'Invalid capability' },
        { status: 400 }
      );
    }

    // 如果指定了 provider，直接返回该 provider 的模型
    if (provider) {
      let models = getModelsByProvider(provider);
      // 如果指定了 capability，进一步过滤
      if (capability) {
        models = models.filter((m) => m.capabilities.includes(capability as Capability));
      }
      return NextResponse.json({ models, provider, capability });
    }

    // 如果只需要用户已配置的模型
    if (userOnly) {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const providerKeys = await getUserProviderKeys(user.id);
      const configuredProviders = providerKeys.map((k) => k.provider);

      let models: ModelInfo[];
      if (capability) {
        // 根据 capability 过滤
        models = getAvailableModelsByCapability(configuredProviders, capability as Capability);
      } else {
        models = getAvailableModels(configuredProviders);
      }

      return NextResponse.json({
        models,
        providers: configuredProviders,
        capability,
        allProviders: getAllProviders(),
      });
    }

    // 默认返回所有模型
    let models = getAllModels();
    // 如果指定了 capability，过滤模型
    if (capability) {
      models = models.filter((m) => m.capabilities.includes(capability as Capability));
    }

    return NextResponse.json({
      models,
      capability,
      allProviders: getAllProviders(),
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

