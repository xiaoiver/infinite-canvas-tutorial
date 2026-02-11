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
import { Info, Save, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ALL_CAPABILITIES, isValidCapability, type Capability } from '@/lib/models/capabilities';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';

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
  const tCommon = useTranslations('common');
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
  // 保存初始状态，用于检测是否有修改
  const [initialPreferences, setInitialPreferences] = useState<Record<Capability, CapabilityPreference | null>>(
    initialPrefsMap
  );
  const [capabilityModels, setCapabilityModels] = useState<Record<Capability, Model[]>>(
    {} as Record<Capability, Model[]>
  );
  const [availableProviders, setAvailableProviders] = useState<Provider[]>(providers);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

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

    ALL_CAPABILITIES.forEach((capability) => {
      loadModelsForCapability(capability);
    });
  }, [providerKeys]);

  const handleSaveCapability = async (capability: Capability) => {
    const pref = preferences[capability];
    if (!pref || !pref.provider || !pref.model) {
      toast.error(t('selectProviderAndModel'));
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
        const updatedPref = {
          id: saved.id,
          capability: saved.capability as Capability,
          provider: saved.provider,
          model: saved.model,
          providerKeyId: saved.providerKeyId,
          config: saved.config || {},
        };
        setPreferences((prev) => ({
          ...prev,
          [capability]: updatedPref,
        }));
        // 更新初始状态，因为保存成功后当前状态就是新的初始状态
        setInitialPreferences((prev) => ({
          ...prev,
          [capability]: updatedPref,
        }));
        toast.success(t('saveSuccess'));
      } else {
        const error = await res.json();
        toast.error(t('saveFailedWithError', { error: error.error }));
      }
    } catch (error) {
      console.error('Failed to save capability preference:', error);
      toast.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCapability = async (capability: Capability) => {
    const pref = preferences[capability];
    if (!pref || !pref.id) {
      return; // 如果没有配置，不需要删除
    }

    toast(t('deleteConfirm'), {
      action: {
        label: t('deleteConfig'),
        onClick: async () => {
          setDeleting(capability);
          try {
            const res = await fetch(`/api/user/capability-preferences/${capability}`, {
              method: 'DELETE',
            });

            if (res.ok) {
              setPreferences((prev) => ({
                ...prev,
                [capability]: null,
              }));
              // 更新初始状态
              setInitialPreferences((prev) => ({
                ...prev,
                [capability]: null,
              }));
              toast.success(t('deleteSuccess'));
            } else {
              const error = await res.json();
              toast.error(t('deleteFailedWithError', { error: error.error }));
            }
          } catch (error) {
            console.error('Failed to delete capability preference:', error);
            toast.error(t('deleteFailed'));
          } finally {
            setDeleting(null);
          }
        },
      },
      cancel: {
        label: tCommon('cancel'),
        onClick: () => {},
      },
      duration: Infinity, // 保持显示直到用户操作
    });
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

  // 检查某个 capability 是否有修改
  const hasChanges = (capability: Capability): boolean => {
    const current = preferences[capability];
    const initial = initialPreferences[capability];

    // 如果当前没有 provider 或 model，说明没有有效配置，不算有修改
    if (!current || !current.provider || !current.model) {
      return false;
    }

    // 如果初始状态是 null，当前有配置，说明是新增，算有修改
    if (!initial) {
      return true;
    }

    // 比较 provider 和 model 是否改变
    return current.provider !== initial.provider || current.model !== initial.model;
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
          {ALL_CAPABILITIES.map((capability) => {
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
                <div className="min-w-0 flex items-center gap-1">
                  <span className="text-sm font-medium">{t(capability)}</span>
                  {(capability === 'vectorize' || capability === 'image-layered') && <HoverCard>
                    <HoverCardTrigger>
                      <Info className="h-3.5 w-3.5" />
                    </HoverCardTrigger>
                    <HoverCardContent>
                      <p className="text-sm">
                        {capability === 'vectorize' && <>
                          {t('vectorizeInfoPrefix')}{' '}
                        <a className="text-blue-500" href="https://github.com/visioncortex/vtracer" target="_blank" rel="noopener noreferrer">
                          vtracer
                        </a>
                        {' '}{t('vectorizeInfoSuffix')}
                        </>}

                        {capability === 'image-layered' && <>
                          {t('imageLayeredInfo')}
                        </>}
                      </p>
                    </HoverCardContent>
                  </HoverCard>}
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
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSaveCapability(capability)}
                    disabled={saving || deleting === capability || !pref.provider || !pref.model || !hasChanges(capability)}
                    className="h-7 w-7 shrink-0"
                    type="button"
                    title={t('saveConfig')}
                  >
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteCapability(capability)}
                    disabled={!pref.id || deleting === capability || saving}
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    type="button"
                    title={t('deleteConfig')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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

