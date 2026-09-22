-- 移除 chats 表的 messages 字段（如果存在）
-- 注意：如果 chats 表中已有 messages 数据，需要先迁移到 messages 表
-- 此迁移假设数据已经迁移完成

ALTER TABLE public.chats
DROP COLUMN IF EXISTS messages;

