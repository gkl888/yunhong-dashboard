-- 为 groups 表添加 carryover_amount 列（上月遗留业绩）
-- 在 Supabase 控制台 → SQL Editor → New query 中执行

-- 添加列（如果不存在）
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS carryover_amount INTEGER DEFAULT 0;

-- 为现有记录设置默认值
UPDATE public.groups 
SET carryover_amount = 0 
WHERE carryover_amount IS NULL;

-- 验证结果
SELECT name, target, leader, deputy, manual_qualified_count, carryover_amount 
FROM public.groups;
