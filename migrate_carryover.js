// 迁移脚本：为 groups 表添加 carryover_amount（上个月遗留业绩）字段
// 运行方式：node migrate_carryover.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://daqmnndkovghgpsnnwiv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZevdbdmROJ4osSaldZFI-g_uU9x_H6V';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrate() {
  const groups = ['一组', '二组', '三组'];

  for (const name of groups) {
    const { data, error } = await supabase
      .from('groups')
      .update({ carryover_amount: 0 })
      .eq('name', name);

    if (error) {
      console.log(`${name} 更新失败:`, error.message);
    } else {
      console.log(`${name} 已设置 carryover_amount = 0`);
    }
  }

  console.log('迁移完成！请确认 groups 表已新增 carryover_amount 列（INTEGER，默认0）');
}

migrate();