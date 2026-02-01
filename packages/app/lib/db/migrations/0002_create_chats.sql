-- 创建 chats 表
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 创建外键约束，关联到 projects 表
ALTER TABLE public.chats
ADD CONSTRAINT chats_project_id_fkey
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS chats_project_id_idx ON public.chats(project_id);
CREATE INDEX IF NOT EXISTS chats_created_at_idx ON public.chats(created_at);

-- 创建更新时间触发器
CREATE TRIGGER update_chats_updated_at
BEFORE UPDATE ON public.chats
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 启用 Row Level Security (RLS)
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- 创建策略：用户只能查看自己项目下的聊天记录
CREATE POLICY "Users can view chats from their own projects"
ON public.chats
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = chats.project_id
    AND projects.user_id = auth.uid()
  )
);

-- 创建策略：用户只能为自己项目创建聊天记录
CREATE POLICY "Users can create chats for their own projects"
ON public.chats
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = chats.project_id
    AND projects.user_id = auth.uid()
  )
);

-- 创建策略：用户只能更新自己项目下的聊天记录
CREATE POLICY "Users can update chats from their own projects"
ON public.chats
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = chats.project_id
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = chats.project_id
    AND projects.user_id = auth.uid()
  )
);

-- 创建策略：用户只能删除自己项目下的聊天记录
CREATE POLICY "Users can delete chats from their own projects"
ON public.chats
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = chats.project_id
    AND projects.user_id = auth.uid()
  )
);

