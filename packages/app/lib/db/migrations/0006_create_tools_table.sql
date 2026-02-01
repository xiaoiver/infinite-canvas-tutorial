-- 创建 tools 表（存储 message 中的 tool call）
CREATE TABLE IF NOT EXISTS public.tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  tool_call_id TEXT NOT NULL,
  tool_type TEXT NOT NULL,
  tool_name TEXT,
  state TEXT NOT NULL CHECK (state IN (
    'input-streaming',
    'input-available',
    'approval-requested',
    'approval-responded',
    'output-available',
    'output-error',
    'output-denied'
  )),
  input JSONB,
  output JSONB,
  error_text TEXT,
  title TEXT,
  provider_executed BOOLEAN,
  call_provider_metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 创建外键约束，关联到 messages 表
ALTER TABLE public.tools
ADD CONSTRAINT tools_message_id_fkey
FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS tools_message_id_idx ON public.tools(message_id);
CREATE INDEX IF NOT EXISTS tools_tool_call_id_idx ON public.tools(tool_call_id);
CREATE INDEX IF NOT EXISTS tools_tool_type_idx ON public.tools(tool_type);
CREATE INDEX IF NOT EXISTS tools_state_idx ON public.tools(state);
CREATE INDEX IF NOT EXISTS tools_created_at_idx ON public.tools(created_at);

-- 创建更新时间触发器
CREATE TRIGGER update_tools_updated_at
BEFORE UPDATE ON public.tools
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 启用 Row Level Security (RLS)
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

-- 创建策略：用户只能查看自己项目下聊天记录消息的 tool calls
CREATE POLICY "Users can view tools from their own project messages"
ON public.tools
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.messages
    INNER JOIN public.chats ON chats.id = messages.chat_id
    INNER JOIN public.projects ON projects.id = chats.project_id
    WHERE messages.id = tools.message_id
    AND projects.user_id = auth.uid()
  )
);

-- 创建策略：用户只能为自己项目下的消息创建 tool calls
CREATE POLICY "Users can create tools for their own project messages"
ON public.tools
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.messages
    INNER JOIN public.chats ON chats.id = messages.chat_id
    INNER JOIN public.projects ON projects.id = chats.project_id
    WHERE messages.id = tools.message_id
    AND projects.user_id = auth.uid()
  )
);

-- 创建策略：用户只能更新自己项目下消息的 tool calls
CREATE POLICY "Users can update tools from their own project messages"
ON public.tools
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.messages
    INNER JOIN public.chats ON chats.id = messages.chat_id
    INNER JOIN public.projects ON projects.id = chats.project_id
    WHERE messages.id = tools.message_id
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.messages
    INNER JOIN public.chats ON chats.id = messages.chat_id
    INNER JOIN public.projects ON projects.id = chats.project_id
    WHERE messages.id = tools.message_id
    AND projects.user_id = auth.uid()
  )
);

-- 创建策略：用户只能删除自己项目下消息的 tool calls
CREATE POLICY "Users can delete tools from their own project messages"
ON public.tools
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.messages
    INNER JOIN public.chats ON chats.id = messages.chat_id
    INNER JOIN public.projects ON projects.id = chats.project_id
    WHERE messages.id = tools.message_id
    AND projects.user_id = auth.uid()
  )
);

