const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://daqmnndkovghgpsnnwiv.supabase.co', 'sb_publishable_ZevdbdmROJ4osSaldZFI-g_uU9x_H6V');

async function migrate() {
  // Supabase JS client不支持ALTER TABLE，需要通过PostgREST schema cache刷新
  // 方法：先尝试使用postgrest的exec_sql（如果存在），或者手动通知postgrest刷新schema
  
  // 方法1：通过REST API的rpc调用一个存储过程
  // 实际上supabase-js不支持DDL，需要在Supabase后台的SQL编辑器中执行
  
  // 方法2：尝试用一个会触发schema重新加载的操作
  // 插入临时数据然后立即删除
  console.log('需要手动在Supabase SQL编辑器执行以下SQL:');
  console.log('ALTER TABLE groups ADD COLUMN IF NOT EXISTS leader text;');
  console.log('ALTER TABLE groups ADD COLUMN IF NOT EXISTS deputy text;');
  console.log('');
  console.log('或者使用NOTIFY pgrst, "reload schema";让API知道新字段');
  console.log('');
  
  // 检查是否有notif功能
  const { data, error } = await supabase.rpc('notify_pgrst');
  console.log('rpc notify_pgrst:', error ? error.message : '调用成功');
}

migrate();
