-- 添加 canvas_data 字段到 projects 表
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS canvas_data TEXT;

