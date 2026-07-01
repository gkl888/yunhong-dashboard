// 迁移脚本：为groups表添加 manual_qualified_count 字段
// 运行方式：node migrate_manual_qualified.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://daqmnndkovghgpsnnwiv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZevdbdmROJ4osSaldZFI-g_uU9x_H6V';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrate() {
  // 更新现有groups记录，添加 manual_qualified_count 字段（默认0）
  const groups = ['一组', '二组', '三组'];
  
  for (const name of groups) {
    const { data, error } = await supabase
      .from('groups')
      .update({ manual_qualified_count: 0 })
      .eq('name', name);
    
    if (error) {
      console.log(`${name} 更新失败:`, error.message);
    } else {
      console.log(`${name} 已设置 manual_qualified_count = 0`);
    }
  }
  
  console.log('迁移完成！');
}

migrate();
