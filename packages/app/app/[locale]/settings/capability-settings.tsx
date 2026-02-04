'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ALL_CAPABILITIES, isValidCapability, type Capability } from '@/lib/models/capabilities';

interface Provider {
  value: string;
  label: string;
}

interface Model {
  value: string;
  label: string;
  provider: string;
}

interface CapabilityPreference {
  id?: string;
  capability: Capability;
  provider: string;
  model: string;
  providerKeyId?: string | null;
  config?: unknown;
}

interface CapabilitySettingsProps {
  providerKeys: Array<{ id: string; provider: string; label: string | null }>;
  providers: Provider[];
  modelsByProvider: Record<string, Model[]>;
  initialCapabilityPreferences: Array<{
    id: string;
    capability: string;
    provider: string;
    model: string;
    providerKeyId: string | null;
    config: unknown | null;
  }>;
}

export function CapabilitySettings({
  providerKeys,
  providers,
  modelsByProvider,
  initialCapabilityPreferences,
}: CapabilitySettingsProps) {
  const t = useTranslations('settings.capabilities');
  // 初始化 preferences 从服务器端数据
  const initialPrefsMap: Record<Capability, CapabilityPreference | null> = {} as any;
  initialCapabilityPreferences.forEach((pref) => {
    if (isValidCapability(pref.capability)) {
      initialPrefsMap[pref.capability as Capability] = {
        id: pref.id,
        capability: pref.capability as Capability,
        provider: pref.provider,
        model: pref.model,
        providerKeyId: pref.providerKeyId,
        config: pref.config || {},
      };
    }
  });

  const [preferences, setPreferences] = useState<Record<Capability, CapabilityPreference | null>>(
    initialPrefsMap
  );
  const [capabilityModels, setCapabilityModels] = useState<Record<Capability, Model[]>>(
    {} as Record<Capability, Model[]>
  );
  const [availableProviders, setAvailableProviders] = useState<Provider[]>(providers);
  const [saving, setSaving] = useState(false);

  // 在客户端加载按 capability 过滤的模型（因为需要动态过滤）
  // 当 providerKeys 变化时，重新加载模型数据以反映新添加的 Provider
  useEffect(() => {
    const loadModelsForCapability = async (capability: Capability) => {
      try {
        const res = await fetch(`/api/models?userOnly=true&capability=${capability}`);
        if (res.ok) {
          const data = await res.json();
          const models = (data.models || []) as Model[];
          setCapabilityModels((prev) => ({
            ...prev,
            [capability]: models,
          }));
          
          // 从 API 响应中更新 providers 列表（使用 allProviders）
          // 这样当添加新的 API Key 后，providers 列表会自动更新
          if (data.allProviders) {
            setAvailableProviders(data.allProviders as Provider[]);
          }
        }
      } catch (error) {
        console.error(`Failed to load models for capability ${capability}:`, error);
      }
    };

    ALL_CAPABILITIES.filter(capability => capability === 'chat' || capability === 'image').forEach((capability) => {
      loadModelsForCapability(capability);
    });
  }, [providerKeys]);

  const handleSaveCapability = async (capability: Capability) => {
    const pref = preferences[capability];
    if (!pref || !pref.provider || !pref.model) {
      alert(t('selectProviderAndModel'));
      return;
    }

    setSaving(true);
    try {
      // 找到对应 provider 的第一个 key（按创建时间排序，第一个就是最早创建的）
      const firstKey = providerKeys.find(
        (k) => k.provider === pref.provider
      );

      const res = await fetch('/api/user/capability-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capability,
          provider: pref.provider,
          model: pref.model,
          providerKeyId: firstKey?.id || null,
          config: pref.config || {},
        }),
      });

      if (res.ok) {
        const saved = await res.json();
        setPreferences((prev) => ({
          ...prev,
          [capability]: saved,
        }));
        alert(t('saveSuccess'));
      } else {
        const error = await res.json();
        alert(t('saveFailedWithError', { error: error.error }));
      }
    } catch (error) {
      console.error('Failed to save capability preference:', error);
      alert(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (capability: Capability, field: keyof CapabilityPreference, value: any) => {
    setPreferences((prev) => {
      const current = prev[capability] || { capability, provider: '', model: '' };
      return {
        ...prev,
        [capability]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-1">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('description')}
        </p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="divide-y">
          {ALL_CAPABILITIES.filter(capability => capability === 'chat' || capability === 'image').map((capability) => {
            const pref = preferences[capability] || { capability, provider: '', model: '' };
            
            // 获取该 capability 对应的模型列表（已按 capability 过滤）
            const modelsForCapability = capabilityModels[capability] || [];
            
            // 如果选择了 provider，进一步过滤
            const availableModels = pref.provider
              ? modelsForCapability.filter((m) => m.provider === pref.provider)
              : modelsForCapability;
            
            // 获取该 capability 支持的 providers（去重）
            const providerSet = new Set(modelsForCapability.map((m) => m.provider));
            const filteredProviders = availableProviders.filter((p) => providerSet.has(p.value));

            return (
              <div
                key={capability}
                className="grid grid-cols-[1fr_1.5fr_1.5fr_auto] gap-4 items-center p-3 hover:bg-muted/30 transition-colors"
              >
                {/* Capability 列 */}
                <div className="min-w-0">
                  <span className="text-sm font-medium">{t(capability)}</span>
                </div>

                {/* Provider 列 */}
                <div className="min-w-0">
                  <Select
                    value={pref.provider}
                    onValueChange={(value) => {
                      updatePreference(capability, 'provider', value);
                      updatePreference(capability, 'model', ''); // 重置模型选择
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder={t('selectProvider')} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredProviders.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Model 列 */}
                <div className="min-w-0">
                  <Select
                    value={pref.model}
                    onValueChange={(value) => updatePreference(capability, 'model', value)}
                    disabled={!pref.provider || availableModels.length === 0}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder={t('selectModel')} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Actions 列 */}
                <div className="flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSaveCapability(capability)}
                    disabled={saving || !pref.provider || !pref.model}
                    className="h-7 w-7 shrink-0"
                    type="button"
                    title={t('saveConfig')}
                  >
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

