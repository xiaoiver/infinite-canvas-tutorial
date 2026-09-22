'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Eye, EyeOff, Copy, Check, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CapabilitySettings } from './capability-settings';

interface ProviderKey {
  id: string;
  provider: string;
  label: string | null;
  apiKeyEncrypted: string; // API Key（实际存储的字段名，但内容是明文）
}

interface Provider {
  value: string;
  label: string;
}

interface Model {
  value: string;
  label: string;
  provider: string;
}

interface SettingsClientProps {
  locale: string;
  initialProviderKeys: ProviderKey[];
  initialProviders: Provider[];
  initialModelsByProvider: Record<string, Model[]>;
  initialCapabilityPreferences: Array<{
    id: string;
    capability: string;
    provider: string;
    model: string;
    providerKeyId: string | null;
    config: unknown | null;
  }>;
}

export default function SettingsClient({
  locale,
  initialProviderKeys,
  initialProviders,
  initialModelsByProvider,
  initialCapabilityPreferences,
}: SettingsClientProps) {
  const t = useTranslations('settings');
  const tApiKeys = useTranslations('settings.apiKeys');
  const [providerKeys, setProviderKeys] = useState<ProviderKey[]>(initialProviderKeys);
  const [saving, setSaving] = useState(false);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 添加新 key 的表单状态
  const [newKeyProvider, setNewKeyProvider] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyLabel, setNewKeyLabel] = useState('');

  // 编辑 key 的表单状态
  const [editKeyProvider, setEditKeyProvider] = useState('');
  const [editKeyValue, setEditKeyValue] = useState('');
  const [editKeyLabel, setEditKeyLabel] = useState('');

  const handleAddProviderKey = async () => {
    if (!newKeyProvider || !newKeyValue) {
      toast.error(tApiKeys('fillProviderAndKey'));
      return;
    }

    setSaving(true);
    try {
      // 直接发送 API Key（明文）
      // 安全性：通过 HTTPS 传输，后端有认证和 RLS 保护
      const res = await fetch('/api/user/provider-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: newKeyProvider,
          apiKeyEncrypted: newKeyValue, // 字段名保持 apiKeyEncrypted，但内容是明文
          label: newKeyLabel || null,
        }),
      });

      if (res.ok) {
        const newKey = await res.json();
        setProviderKeys([...providerKeys, newKey]);
        // 重置表单并关闭弹窗
        setNewKeyProvider('');
        setNewKeyValue('');
        setNewKeyLabel('');
        setShowAddForm(false);
        toast.success(tApiKeys('addSuccess') || 'API Key 添加成功');
      } else {
        const error = await res.json();
        toast.error(tApiKeys('addFailedWithError', { error: error.error }));
      }
    } catch (error) {
      console.error('Failed to add provider key:', error);
      toast.error(tApiKeys('addFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProviderKey = async (id: string) => {
    toast(tApiKeys('deleteConfirm'), {
      action: {
        label: tApiKeys('delete') || '删除',
        onClick: async () => {
          try {
            const res = await fetch(`/api/user/provider-keys/${id}`, {
              method: 'DELETE',
            });

            if (res.ok) {
              setProviderKeys(providerKeys.filter((k) => k.id !== id));
              toast.success(tApiKeys('deleteSuccess') || '删除成功');
            } else {
              toast.error(tApiKeys('deleteFailed'));
            }
          } catch (error) {
            console.error('Failed to delete provider key:', error);
            toast.error(tApiKeys('deleteFailed'));
          }
        },
      },
      cancel: {
        label: tApiKeys('cancel') || '取消',
        onClick: () => {},
      },
      duration: Infinity, // 保持显示直到用户操作
    });
  };

  const handleCopyKey = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const toggleShowValue = (id: string) => {
    setShowValues((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleEditProviderKey = (key: ProviderKey) => {
    setEditingId(key.id);
    setEditKeyProvider(key.provider);
    setEditKeyValue(key.apiKeyEncrypted);
    setEditKeyLabel(key.label || '');
  };

  const handleUpdateProviderKey = async () => {
    if (!editingId || !editKeyProvider || !editKeyValue) {
      toast.error(tApiKeys('fillProviderAndKey'));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/user/provider-keys/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: editKeyProvider,
          apiKeyEncrypted: editKeyValue,
          label: editKeyLabel || null,
        }),
      });

      if (res.ok) {
        const updatedKey = await res.json();
        setProviderKeys(providerKeys.map((k) => (k.id === editingId ? updatedKey : k)));
        // 重置表单并关闭弹窗
        setEditingId(null);
        setEditKeyProvider('');
        setEditKeyValue('');
        setEditKeyLabel('');
        toast.success(tApiKeys('updateSuccess'));
      } else {
        const error = await res.json();
        toast.error(tApiKeys('updateFailedWithError', { error: error.error }));
      }
    } catch (error) {
      console.error('Failed to update provider key:', error);
      toast.error(tApiKeys('updateFailed'));
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {tApiKeys('description')}
        </p>
      </div>

      {/* Provider Keys 管理 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">{tApiKeys('title')}</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
            className="h-8"
          >
            {tApiKeys('addNew')}
          </Button>
        </div>

        {/* 添加新 Key 弹窗 */}
        <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{tApiKeys('addNew')}</DialogTitle>
              <DialogDescription>
                {tApiKeys('description')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {tApiKeys('provider')}
                  </label>
                  <Select value={newKeyProvider} onValueChange={setNewKeyProvider}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={tApiKeys('selectProvider')} />
                    </SelectTrigger>
                    <SelectContent>
                      {initialProviders.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {tApiKeys('apiKey')}
                  </label>
                  <Input
                    type="password"
                    value={newKeyValue}
                    onChange={(e) => setNewKeyValue(e.target.value)}
                    placeholder={tApiKeys('apiKeyPlaceholder')}
                    className="h-9 font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {tApiKeys('label')}
                  </label>
                  <Input
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder={tApiKeys('labelPlaceholder')}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setNewKeyProvider('');
                  setNewKeyValue('');
                  setNewKeyLabel('');
                }}
              >
                {tApiKeys('cancel')}
              </Button>
              <Button
                onClick={handleAddProviderKey}
                disabled={saving || !newKeyProvider || !newKeyValue}
              >
                {saving ? (
                  <>{tApiKeys('adding')}</>
                ) : (
                  <>
                    {tApiKeys('add')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 编辑 Key 弹窗 */}
        <Dialog open={editingId !== null} onOpenChange={(open) => {
          if (!open) {
            setEditingId(null);
            setEditKeyProvider('');
            setEditKeyValue('');
            setEditKeyLabel('');
          }
        }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{tApiKeys('editKey')}</DialogTitle>
              <DialogDescription>
                {tApiKeys('editDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {tApiKeys('provider')}
                  </label>
                  <Select value={editKeyProvider} onValueChange={setEditKeyProvider}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={tApiKeys('selectProvider')} />
                    </SelectTrigger>
                    <SelectContent>
                      {initialProviders.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {tApiKeys('apiKey')}
                  </label>
                  <Input
                    type="text"
                    value={editKeyValue}
                    onChange={(e) => setEditKeyValue(e.target.value)}
                    placeholder={tApiKeys('apiKeyPlaceholder')}
                    className="h-9 font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {tApiKeys('label')}
                  </label>
                  <Input
                    value={editKeyLabel}
                    onChange={(e) => setEditKeyLabel(e.target.value)}
                    placeholder={tApiKeys('labelPlaceholder')}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setEditKeyProvider('');
                  setEditKeyValue('');
                  setEditKeyLabel('');
                }}
              >
                {tApiKeys('cancel')}
              </Button>
              <Button
                onClick={handleUpdateProviderKey}
                disabled={saving || !editKeyProvider || !editKeyValue}
              >
                {saving ? (
                  <>{tApiKeys('updating')}</>
                ) : (
                  <>{tApiKeys('update')}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 现有 Keys 列表 - Vercel 风格表格 */}
        {providerKeys.length === 0 ? (
          <div className="border rounded-lg p-8 text-center">
            <p className="text-sm text-muted-foreground">{tApiKeys('noKeys')}</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="divide-y">
              {providerKeys.map((key, index) => {
                const providerLabel =
                  initialProviders.find((p) => p.value === key.provider)?.label ||
                  key.provider;
                const isValueVisible = showValues[key.id];
                // 直接使用 API Key（明文）
                // 安全性：这是用户自己的数据，有认证保护，默认使用 password 类型隐藏
                const displayValue = key.apiKeyEncrypted || '';

                return (
                  <div
                    key={key.id}
                    className="grid grid-cols-[1fr_2fr_auto] gap-4 items-center p-3 hover:bg-muted/30 transition-colors"
                  >
                    {/* Key 列 */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">{providerLabel}</span>
                      {key.label && (
                        <span className="text-xs text-muted-foreground truncate">
                          {key.label}
                        </span>
                      )}
                    </div>

                    {/* Value 列 */}
                    <div className="flex items-center gap-2 min-w-0">
                      <Input
                        id={`api-key-${key.id}`}
                        type={isValueVisible ? 'text' : 'password'}
                        value={displayValue}
                        readOnly
                        placeholder="sk-..."
                        className="h-8 font-mono text-xs flex-1"
                      />
                    </div>

                    {/* Actions 列 */}
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleShowValue(key.id)}
                        className="h-7 w-7 shrink-0"
                        type="button"
                        title={isValueVisible ? '隐藏' : '显示'}
                      >
                        {isValueVisible ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyKey(key.id, displayValue)}
                        className="h-7 w-7 shrink-0"
                        title={tApiKeys('copy')}
                        type="button"
                      >
                        {copiedId === key.id ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditProviderKey(key)}
                        className="h-7 w-7 shrink-0"
                        title={tApiKeys('edit')}
                        type="button"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteProviderKey(key.id)}
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title={tApiKeys('delete')}
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <CapabilitySettings
          providerKeys={providerKeys}
          providers={initialProviders}
          modelsByProvider={initialModelsByProvider}
          initialCapabilityPreferences={initialCapabilityPreferences}
        />
      </section>
    </div>
  );
}

