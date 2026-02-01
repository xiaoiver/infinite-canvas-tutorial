-- 创建 messages 表
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL,
  seq INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  text TEXT,
  metadata JSONB,
  status TEXT,
  is_final BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 创建外键约束，关联到 chats 表
ALTER TABLE public.messages
ADD CONSTRAINT messages_chat_id_fkey
FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS messages_chat_id_idx ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS messages_chat_id_seq_idx ON public.messages(chat_id, seq);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(created_at);

-- 创建更新时间触发器
CREATE TRIGGER update_messages_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 启用 Row Level Security (RLS)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 创建策略：用户只能查看自己项目下聊天记录的消息
CREATE POLICY "Users can view messages from their own project chats"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chats
    INNER JOIN public.projects ON projects.id = chats.project_id
    WHERE chats.id = messages.chat_id
    AND projects.user_id = auth.uid()
  )
);

-- 创建策略：用户只能为自己项目下的聊天记录创建消息
CREATE POLICY "Users can create messages for their own project chats"
ON public.messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chats
    INNER JOIN public.projects ON projects.id = chats.project_id
    WHERE chats.id = messages.chat_id
    AND projects.user_id = auth.uid()
  )
);

-- 创建策略：用户只能更新自己项目下聊天记录的消息
CREATE POLICY "Users can update messages from their own project chats"
ON public.messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.chats
    INNER JOIN public.projects ON projects.id = chats.project_id
    WHERE chats.id = messages.chat_id
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chats
    INNER JOIN public.projects ON projects.id = chats.project_id
    WHERE chats.id = messages.chat_id
    AND projects.user_id = auth.uid()
  )
);

-- 创建策略：用户只能删除自己项目下聊天记录的消息
CREATE POLICY "Users can delete messages from their own project chats"
ON public.messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.chats
    INNER JOIN public.projects ON projects.id = chats.project_id
    WHERE chats.id = messages.chat_id
    AND projects.user_id = auth.uid()
  )
);

