import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/topbar';
import SettingsClient from './settings-client';
import { getUserProviderKeys, getUserCapabilityPreferences } from '@/lib/db/user-preferences';
import { getAllProviders, getAvailableModels } from '@/lib/models/registry';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // 获取用户信息
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 如果未登录，重定向到登录页
  if (!user) {
    redirect(`/${locale}/login`);
  }

  // 在服务器端获取所有需要的数据
  const [providerKeys, capabilityPreferences] = await Promise.all([
    getUserProviderKeys(user.id),
    getUserCapabilityPreferences(user.id),
  ]);

  // 获取所有 providers 和 models
  const allProviders = getAllProviders();
  const configuredProviders = providerKeys.map((k) => k.provider);
  const allModels = getAvailableModels(configuredProviders);

  // 按 provider 组织模型
  const modelsByProvider: Record<string, typeof allModels> = {};
  allModels.forEach((model) => {
    if (!modelsByProvider[model.provider]) {
      modelsByProvider[model.provider] = [];
    }
    modelsByProvider[model.provider].push(model);
  });

  return (
    <div className="flex flex-col h-screen">
      <Topbar />
      <div className="flex-1 overflow-auto">
        <SettingsClient
          locale={locale}
          initialProviderKeys={providerKeys}
          initialProviders={allProviders}
          initialModelsByProvider={modelsByProvider}
          initialCapabilityPreferences={capabilityPreferences}
        />
      </div>
    </div>
  );
}

