// 使用 Supabase REST API 执行 SQL 添加列
const https = require('https');

const SUPABASE_URL = 'daqmnndkovghgpsnnwiv.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_publishable_ZevdbdmROJ4osSaldZFI-g_uU9x_H6V';

// 注意：需要使用 service_role key 才能执行 DDL
// anon key 无法执行 ALTER TABLE

const sql = `ALTER TABLE groups ADD COLUMN IF NOT EXISTS manual_qualified_count INTEGER DEFAULT 0;`;

const options = {
  hostname: SUPABASE_URL,
  path: '/rest/v1/rpc/exec_sql',  // 需要启用 pg_net 扩展
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
  }
};

console.log('请在 Supabase 控制台执行以下 SQL:');
console.log('');
console.log(sql);
console.log('');
console.log('路径: SQL Editor → New Query');
