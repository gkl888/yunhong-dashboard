# Supabase 设置步骤

## 1. 添加 carryover_amount 列

1. 打开 https://supabase.com/dashboard
2. 选择项目 `daqmnndkovghgpsnnwiv`
3. 左侧菜单 → **Table Editor**
4. 点击 **groups** 表
5. 点击表头右侧的 **+** 按钮（或右键表头选择 Add column）
6. 填写：
   - **Name**: `carryover_amount`
   - **Type**: `int4` (integer)
   - **Default Value**: `0`
   - **Is Nullable**: 勾选 ✅
7. 点击 **Save**

## 2. 初始化数据（可选）

在 **SQL Editor** → **New query** 中执行：

```sql
UPDATE public.groups 
SET carryover_amount = 0 
WHERE carryover_amount IS NULL;
```

## 3. 验证

执行查询：
```sql
SELECT name, target, leader, deputy, manual_qualified_count, carryover_amount 
FROM public.groups;
```

应显示三组数据，carryover_amount 均为 0。

---

完成后，访问 https://yunhong-dashboard.onrender.com/manage.html 即可使用「上月遗留业绩」功能。
