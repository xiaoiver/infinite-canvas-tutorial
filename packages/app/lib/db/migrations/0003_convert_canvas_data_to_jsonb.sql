-- 将 canvas_data 字段从 TEXT 转换为 JSONB
-- 首先，将现有的 TEXT 数据转换为 JSONB（如果数据是有效的 JSON）
-- 对于无效的 JSON 数据，设置为 NULL

-- 步骤 1: 添加新的 JSONB 列（临时）
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS canvas_data_jsonb JSONB;

-- 步骤 2: 将现有的 TEXT 数据转换为 JSONB
-- 使用安全的方式转换，无效的 JSON 设置为 NULL
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id, canvas_data FROM public.projects WHERE canvas_data IS NOT NULL LOOP
    BEGIN
      UPDATE public.projects
      SET canvas_data_jsonb = CASE
        WHEN rec.canvas_data = '' THEN NULL
        ELSE rec.canvas_data::jsonb
      END
      WHERE id = rec.id;
    EXCEPTION WHEN OTHERS THEN
      -- 如果转换失败（无效的 JSON），设置为 NULL
      UPDATE public.projects
      SET canvas_data_jsonb = NULL
      WHERE id = rec.id;
    END;
  END LOOP;
END $$;

-- 步骤 3: 删除旧的 TEXT 列
ALTER TABLE public.projects
DROP COLUMN IF EXISTS canvas_data;

-- 步骤 4: 重命名新列为 canvas_data
ALTER TABLE public.projects
RENAME COLUMN canvas_data_jsonb TO canvas_data;

