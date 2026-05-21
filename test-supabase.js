const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://daqmnndkovghgpsnnwiv.supabase.co', 'sb_publishable_ZevdbdmROJ4osSaldZFI-g_uU9x_H6V');

async function test() {
  console.log('测试 Supabase 数据...\n');
  
  // 检查 groups 表
  const { data: groups, error: e1 } = await supabase.from('groups').select('*');
  if (e1) {
    console.error('❌ groups 表错误:', e1.message);
  } else {
    console.log('✅ groups 表数据:', groups?.length, '条');
    console.log(groups);
  }
  
  console.log('');
  
  // 检查 deals 表
  const { data: deals, error: e2, count } = await supabase.from('deals').select('*', { count: 'exact' });
  if (e2) {
    console.error('❌ deals 表错误:', e2.message);
  } else {
    console.log('✅ deals 表数据:', count, '条');
    if (deals && deals.length > 0) {
      console.log('前3条:');
      deals.slice(0, 3).forEach(d => {
        console.log(`  - ID ${d.id}: ${d.time} | ${d.group_name} | ${d.salesperson} | ¥${d.amount}`);
      });
    }
  }
}

test();
