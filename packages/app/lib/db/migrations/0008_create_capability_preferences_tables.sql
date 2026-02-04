-- 创建 user_capability_preferences 表（按能力维度配置模型）
CREATE TABLE IF NOT EXISTS public.user_capability_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  capability TEXT NOT NULL CHECK (capability IN ('text', 'chat', 'image', 'audio', 'embedding', 'vision')), -- 注意：数据库约束保留所有值以兼容旧数据，但应用层只使用 'text', 'chat', 'image'
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  provider_key_id UUID,
  config JSONB,
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, capability)
);

-- 创建外键约束，关联到 auth.users 表
ALTER TABLE public.user_capability_preferences
ADD CONSTRAINT user_capability_preferences_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 创建外键约束，关联到 user_provider_keys 表
ALTER TABLE public.user_capability_preferences
ADD CONSTRAINT user_capability_preferences_provider_key_id_fkey
FOREIGN KEY (provider_key_id) REFERENCES public.user_provider_keys(id) ON DELETE SET NULL;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_capability_preferences_user
  ON public.user_capability_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_user_capability_preferences_capability
  ON public.user_capability_preferences(capability);

CREATE INDEX IF NOT EXISTS idx_user_capability_preferences_user_capability
  ON public.user_capability_preferences(user_id, capability);

-- 创建更新时间触发器
CREATE TRIGGER update_user_capability_preferences_updated_at
BEFORE UPDATE ON public.user_capability_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 启用 Row Level Security (RLS)
ALTER TABLE public.user_capability_preferences ENABLE ROW LEVEL SECURITY;

-- 创建策略：用户只能查看自己的能力偏好
CREATE POLICY "Users can view their own capability preferences"
ON public.user_capability_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- 创建策略：用户只能创建自己的能力偏好
CREATE POLICY "Users can create their own capability preferences"
ON public.user_capability_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 创建策略：用户只能更新自己的能力偏好
CREATE POLICY "Users can update their own capability preferences"
ON public.user_capability_preferences
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 创建策略：用户只能删除自己的能力偏好
CREATE POLICY "Users can delete their own capability preferences"
ON public.user_capability_preferences
FOR DELETE
USING (auth.uid() = user_id);

-- 注意：provider_capabilities 表已删除
-- 模型能力信息现在在代码中维护（packages/app/lib/models/registry.ts）
-- 这样可以保持类型安全，避免代码和数据库不同步的问题

