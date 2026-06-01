const { createClient } = require('@supabase/supabase-js');
const c = createClient('https://daqmnndkovghgpsnnwiv.supabase.co', 'sb_publishable_ZevdbdmROJ4osSaldZFI-g_uU9x_H6V');
c.from('deals').select('group_name,salesperson,amount').then(r => {
  const map = {};
  r.data.forEach(d => {
    const k = d.group_name + '|' + d.salesperson;
    if (!map[k]) map[k] = { g: d.group_name, s: d.salesperson, a: 0 };
    map[k].a += d.amount;
  });
  console.log(JSON.stringify(Object.values(map).sort((a, b) => a.g.localeCompare(b.g) || b.a - a.a), null, 2));
});
