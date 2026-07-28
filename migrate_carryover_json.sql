-- 修改 carryover_amount 列类型为 JSONB，用于存储每个人明细
-- 格式: [{"name": "王浩", "amount": 30000}, {"name": "李江龙", "amount": 20000}]

-- 1. 先删除旧列（如果已存在数据，先备份）
-- ALTER TABLE public.groups DROP COLUMN IF EXISTS carryover_amount;

-- 2. 添加 JSONB 类型列
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS carryover_amount JSONB DEFAULT '[]'::jsonb;

-- 3. 初始化数据为空数组
UPDATE public.groups SET carryover_amount = '[]'::jsonb WHERE carryover_amount IS NULL;

-- 4. 验证
SELECT name, carryover_amount FROM public.groups;
