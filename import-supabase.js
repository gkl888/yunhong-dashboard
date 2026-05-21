const fs = require('fs');
const https = require('https');

const SUPABASE_URL = 'https://daqmnndkovghgpsnnwiv.supabase.co';
const API_KEY = 'sb_publishable_ZevdbdmROJ4osSaldZFI-g_uU9x_H6V';

// 读取本地数据
const data = JSON.parse(fs.readFileSync('C:\\Users\\Administrator\\.qclaw\\workspace\\dashboard\\data.json', 'utf8'));
const deals = data.deals;

console.log(`本地有 ${deals.length} 条数据`);

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0
      }
    };
    
    const req = https.request(options, (res) => {
      let chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks).toString();
        try { resolve(JSON.parse(buf)); } catch { resolve(buf); }
      });
    });
    
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  let success = 0;
  let fail = 0;
  
  for (let i = 0; i < deals.length; i++) {
    const deal = deals[i];
    try {
      await request('POST', '/rest/v1/deals', {
        time: deal.time,
        salesperson: deal.salesperson,
        amount: deal.amount,
        group_name: deal.group_name
      });
      console.log(`  ID=${i+1} OK | ${deal.salesperson} | ${deal.group_name}`);
      success++;
    } catch (e) {
      console.log(`  ID=${i+1} FAIL | ${e.message.substring(0, 80)}`);
      fail++;
    }
  }
  
  // 验证
  const result = await request('GET', '/rest/v1/deals?select=id,group_name,salesperson&order=id.desc&limit=3');
  console.log(`\n完成！成功=${success} 失败=${fail}`);
  console.log('最新3条样例:');
  result.forEach(r => console.log(`  id=${r.id} | ${r.salesperson} | ${r.group_name}`));
  
  const count = await request('GET', '/rest/v1/deals?select=id');
  console.log(`总数: ${count.length}`);
}

main().catch(console.error);
