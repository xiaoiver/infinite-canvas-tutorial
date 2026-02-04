-- 创建 user_provider_keys 表（存储各 provider 的 API Key）
CREATE TABLE IF NOT EXISTS public.user_provider_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  label TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider, label)
);

-- 创建外键约束，关联到 auth.users 表
ALTER TABLE public.user_provider_keys
ADD CONSTRAINT user_provider_keys_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_provider_keys_user
  ON public.user_provider_keys(user_id);

CREATE INDEX IF NOT EXISTS idx_user_provider_keys_provider
  ON public.user_provider_keys(provider);

-- 创建更新时间触发器
CREATE TRIGGER update_user_provider_keys_updated_at
BEFORE UPDATE ON public.user_provider_keys
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 启用 Row Level Security (RLS)
ALTER TABLE public.user_provider_keys ENABLE ROW LEVEL SECURITY;

-- 创建策略：用户只能查看自己的 provider keys
CREATE POLICY "Users can view their own provider keys"
ON public.user_provider_keys
FOR SELECT
USING (auth.uid() = user_id);

-- 创建策略：用户只能创建自己的 provider keys
CREATE POLICY "Users can create their own provider keys"
ON public.user_provider_keys
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 创建策略：用户只能更新自己的 provider keys
CREATE POLICY "Users can update their own provider keys"
ON public.user_provider_keys
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 创建策略：用户只能删除自己的 provider keys
CREATE POLICY "Users can delete their own provider keys"
ON public.user_provider_keys
FOR DELETE
USING (auth.uid() = user_id);

-- 注意：user_model_preferences 表已删除
-- 模型配置现在使用 user_capability_preferences 表，支持按能力维度配置
-- 这样可以支持不同能力使用不同的模型（文本、生图、音频等）

-- 创建 user_preferences 表（存储其他 UI/行为偏好）
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY,
  ui_theme TEXT DEFAULT 'system',
  language TEXT DEFAULT 'en',
  extra JSONB,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 创建外键约束，关联到 auth.users 表
ALTER TABLE public.user_preferences
ADD CONSTRAINT user_preferences_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 创建更新时间触发器
CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 启用 Row Level Security (RLS)
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- 创建策略：用户只能查看自己的偏好
CREATE POLICY "Users can view their own preferences"
ON public.user_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- 创建策略：用户只能创建自己的偏好
CREATE POLICY "Users can create their own preferences"
ON public.user_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 创建策略：用户只能更新自己的偏好
CREATE POLICY "Users can update their own preferences"
ON public.user_preferences
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 创建策略：用户只能删除自己的偏好
CREATE POLICY "Users can delete their own preferences"
ON public.user_preferences
FOR DELETE
USING (auth.uid() = user_id);

