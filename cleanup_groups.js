const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://daqmnndkovghgpsnnwiv.supabase.co', 'sb_publishable_ZevdbdmROJ4osSaldZFI-g_uU9x_H6V');

async function cleanup() {
  // 1. 删除四至八组的小组配置
  const { error: groupErr } = await supabase.from('groups').delete().in('name', ['四组','五组','六组','七组','八组']);
  console.log('删除小组配置:', groupErr ? '失败 ' + groupErr.message : '成功');
  
  // 2. 删除四至八组的历史成单
  const { data: deletedDeals, error: dealErr } = await supabase.from('deals').delete().in('group_name', ['四组','五组','六组','七组','八组']).select();
  console.log('删除成单记录:', dealErr ? '失败 ' + dealErr.message : `成功，共${deletedDeals?.length || 0}条`);
  
  // 3. 验证剩余数据
  const { data: groups } = await supabase.from('groups').select('name');
  const { data: deals } = await supabase.from('deals').select('id');
  console.log('剩余小组:', groups?.map(g => g.name).join(', '));
  console.log('剩余成单:', deals?.length, '条');
}

cleanup();
