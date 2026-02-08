-- 添加 'image-layered' capability 到 user_capability_preferences 表的 CHECK 约束
-- 需要先删除旧的约束，然后添加新的约束

-- 1. 删除旧的 CHECK 约束（PostgreSQL 自动生成的约束名称通常是 {table}_{column}_check）
-- 如果约束名称不同，需要先查询：SELECT conname FROM pg_constraint WHERE conrelid = 'public.user_capability_preferences'::regclass AND contype = 'c';
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- 查找 capability 列的 CHECK 约束名称
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.user_capability_preferences'::regclass
      AND contype = 'c'
      AND conname LIKE '%capability%';
    
    -- 如果找到约束，删除它
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.user_capability_preferences DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END IF;
END $$;

-- 2. 添加新的 CHECK 约束，包含 'image-layered'（如果约束不存在）
DO $$
BEGIN
    -- 检查约束是否已存在
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.user_capability_preferences'::regclass
          AND conname = 'user_capability_preferences_capability_check'
    ) THEN
        ALTER TABLE public.user_capability_preferences
        ADD CONSTRAINT user_capability_preferences_capability_check
        CHECK (capability IN ('text', 'chat', 'image', 'image-layered', 'audio', 'embedding', 'vision'));
    END IF;
END $$;

