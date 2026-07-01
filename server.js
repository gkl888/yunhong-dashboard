const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 30000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Supabase 配置
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://daqmnndkovghgpsnnwiv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_ZevdbdmROJ4osSaldZFI-g_uU9x_H6V';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: {
    transport: WebSocket
  }
});

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

// 解析时间字符串中的年月，返回 'YYYY-MM' 格式
function parseYearMonth(timeStr) {
  if (!timeStr) return null;
  const dt = new Date(timeStr.replace(/\//g, '-'));
  if (isNaN(dt.getTime())) return null;
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
}

// 获取当前月份 'YYYY-MM'
function getCurrentMonth() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

// 从 Supabase 读取数据（按月过滤）
async function readData(month) {
  try {
    const targetMonth = month || getCurrentMonth();
    const [dealsRes, groupsRes] = await Promise.all([
      supabase.from('deals').select('*').order('created_at', { ascending: false }),
      supabase.from('groups').select('*')
    ]);
    
    if (dealsRes.error) console.error('Supabase deals error:', dealsRes.error);
    if (groupsRes.error) console.error('Supabase groups error:', groupsRes.error);
    
    // 所有成单数据
    const allDeals = (dealsRes.data || []).map(d => ({
      id: d.id,
      time: d.time,
      groupName: d.group_name,
      salesperson: d.salesperson,
      amount: d.amount
    }));
    
    // 只保留当月成单
    const deals = allDeals.filter(d => parseYearMonth(d.time) === targetMonth);
    
    const groups = (groupsRes.data || []).map(g => ({
      name: g.name,
      target: g.target,
      amount: 0,
      completionRate: 0
    }));
    
    // 计算各小组当月金额和完成率
    deals.forEach(deal => {
      const group = groups.find(g => g.name === deal.groupName);
      if (group) group.amount += deal.amount;
    });
    
    groups.forEach(g => {
      g.completionRate = Math.round((g.amount / g.target) * 100);
    });
    
    // 统计（当月）
    const totalAmount = deals.reduce((s, d) => s + d.amount, 0);
    const totalDeals = deals.length;
    const avgDealSize = totalDeals > 0 ? Math.round(totalAmount / totalDeals) : 0;
    
    // 每日统计（当月）
    const dailyMap = {};
    deals.forEach(d => {
      const dt = new Date(d.time.replace(/\//g, '-'));
      if (!isNaN(dt.getTime())) {
        const ds = (dt.getMonth() + 1) + '/' + dt.getDate();
        dailyMap[ds] = (dailyMap[ds] || 0) + d.amount;
      }
    });
    // 按自然日生成最近7个工作日（跳过周日），无成交显示0
    const today = new Date();
    const days = [];
    for (let i = 0; i < 14 && days.length < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (d.getDay() !== 0) {
        days.push({ date: (d.getMonth() + 1) + '/' + d.getDate(), ts: d.getTime() });
      }
    }
    days.reverse();
    const dailyStats = days.map(item => ({ date: item.date, amount: dailyMap[item.date] || 0 }));
    
    // 个人业绩排名（按销售员汇总）
    const personMap = {};
    deals.forEach(d => {
      if (!personMap[d.salesperson]) personMap[d.salesperson] = 0;
      personMap[d.salesperson] += d.amount;
    });
    const top3 = Object.entries(personMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, amount]) => ({ name, amount }));
    // 按 2-1-3 顺序排列（领奖台样式：亚军-冠军-季军）
    const podium = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
    
    return { deals, groups, stats: { totalAmount, totalDeals, avgDealSize }, dailyStats, month: targetMonth, top3, podium };
  } catch(e) {
    console.error('readData error:', e);
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
    catch(e2) { return { deals: [], groups: [], stats: { totalAmount:0, totalDeals:0, avgDealSize:0 }, dailyStats:[], month: month || getCurrentMonth() }; }
  }
}

function getRequestBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch(e) { resolve(null); }
    });
  });
}

// Broadcast to all connected WebSocket clients
function broadcast(msg) {
  const str = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(str);
    }
  });
}

const server = http.createServer(async (req, res) => {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');

  // API: GET /api/data?month=2026-05
  if (req.method === 'GET' && url.pathname === '/api/data') {
    try {
      const month = url.searchParams.get('month') || '';
      const data = await readData(month || undefined);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '读取数据失败' }));
    }
    return;
  }

  // API: POST /api/deal - 添加成单
  if (req.method === 'POST' && url.pathname === '/api/deal') {
    try {
      const dealData = await getRequestBody(req);
      if (!dealData || !dealData.groupName || !dealData.salesperson || !dealData.amount) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '缺少必填字段' }));
        return;
      }
      
      // 写入 Supabase
      const { data: inserted, error } = await supabase.from('deals').insert({
        time: dealData.time || (function(){ const d=new Date(); d.setHours(d.getHours()+8); const pad=n=>String(n).padStart(2,'0'); return d.getFullYear()+'/'+(d.getMonth()+1)+'/'+d.getDate()+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds()); })(),
        group_name: dealData.groupName,
        salesperson: dealData.salesperson,
        amount: dealData.amount
      }).select().single();
      
      if (error) {
        console.error('Supabase insert error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '数据库写入失败: ' + error.message }));
        return;
      }
      
      const newDeal = {
        id: inserted.id,
        time: inserted.time,
        groupName: inserted.group_name,
        salesperson: inserted.salesperson,
        amount: inserted.amount
      };
      
      broadcast({ type: 'new_deal', deal: newDeal });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, deal: newDeal }));
      console.log('New deal:', newDeal.groupName, newDeal.salesperson, newDeal.amount);
    } catch(e) {
      console.error('Error adding deal:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '服务器错误' }));
    }
    return;
  }

  // API: PUT /api/deal/:id - 修改成单
  if (req.method === 'PUT' && url.pathname.startsWith('/api/deal/')) {
    try {
      const id = parseInt(url.pathname.split('/').pop());
      const updateData = await getRequestBody(req);
      if (!updateData) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '无效数据' }));
        return;
      }
      
      // 构建 Supabase 更新数据
      const updateFields = {};
      if (updateData.groupName) updateFields.group_name = updateData.groupName;
      if (updateData.salesperson) updateFields.salesperson = updateData.salesperson;
      if (updateData.amount) updateFields.amount = updateData.amount;
      if (updateData.time) updateFields.time = updateData.time;
      
      const { data: updated, error } = await supabase.from('deals').update(updateFields).eq('id', id).select().single();
      if (error) {
        console.error('Supabase update error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '更新失败: ' + error.message }));
        return;
      }
      
      const deal = {
        id: updated.id,
        time: updated.time,
        groupName: updated.group_name,
        salesperson: updated.salesperson,
        amount: updated.amount
      };
      
      broadcast({ type: 'update_deal', deal: deal });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, deal: deal }));
    } catch(e) {
      console.error('Error updating deal:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '服务器错误' }));
    }
    return;
  }

  // API: DELETE /api/deal/:id - 删除成单
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/deal/')) {
    try {
      const id = parseInt(url.pathname.split('/').pop());
      
      // 从 Supabase 删除
      const { error } = await supabase.from('deals').delete().eq('id', id);
      if (error) {
        console.error('Supabase delete error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '删除失败: ' + error.message }));
        return;
      }
      
      broadcast({ type: 'delete_deal', id: id });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch(e) {
      console.error('Error deleting deal:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '服务器错误' }));
    }
    return;
  }

  // API: PUT /api/group/:name/target - 设置小组目标
  if (req.method === 'PUT' && url.pathname.match(/^\/api\/group\/.+\/target$/)) {
    try {
      const groupName = decodeURIComponent(url.pathname.split('/')[3]);
      const body = await getRequestBody(req);
      
      if (!body || !body.target) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '缺少目标值' }));
        return;
      }
      
      const { error } = await supabase.from('groups').update({ target: body.target }).eq('name', groupName);
      if (error) {
        console.error('Supabase update target error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '更新目标失败: ' + error.message }));
        return;
      }
      
      broadcast({ type: 'update_target', group: { name: groupName, target: body.target } });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, group: { name: groupName, target: body.target } }));
    } catch(e) {
      console.error('Error setting target:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '服务器错误' }));
    }
    return;
  }

  // API: GET /api/tts?text=xxx — 文字转语音（Google Translate TTS，Render服务器可访问）
  if (req.method === 'GET' && url.pathname === '/api/tts') {
    const text = url.searchParams.get('text');
    if (!text) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'text参数不能为空' }));
      return;
    }
    const encodedText = encodeURIComponent(text);
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=zh-CN&client=tw-ob`;
    https.get(ttsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (ttsRes) => {
      if (ttsRes.statusCode !== 200) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'TTS服务不可用' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      ttsRes.pipe(res);
    }).on('error', (err) => {
      console.error('TTS请求失败:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'TTS服务错误' }));
    });
    return;
  }

  // API: GET /api/report?month=2026-05 - 月报表
  if (req.method === 'GET' && url.pathname === '/api/report') {
    try {
      const month = url.searchParams.get('month') || '';
      // 直接从 Supabase 读取全部成单，按月份过滤
      const [dealsRes, groupsRes] = await Promise.all([
        supabase.from('deals').select('*').order('created_at', { ascending: false }),
        supabase.from('groups').select('*')
      ]);
      
      const allDeals = (dealsRes.data || []).map(d => ({
        id: d.id, time: d.time, groupName: d.group_name, salesperson: d.salesperson, amount: d.amount
      }));
      
      // 按指定月份过滤
      let filtered = allDeals;
      if (month) {
        filtered = allDeals.filter(d => parseYearMonth(d.time) === month);
      }
      
      // 按小组汇总
      const groupReport = {};
      (groupsRes.data || []).forEach(g => {
        groupReport[g.name] = { name: g.name, target: g.target || 500000, amount: 0, dealCount: 0, completionRate: 0 };
      });
      
      filtered.forEach(d => {
        if (groupReport[d.groupName]) {
          groupReport[d.groupName].amount += d.amount;
          groupReport[d.groupName].dealCount++;
        }
      });
      
      // 计算完成率
      Object.values(groupReport).forEach(g => {
        g.completionRate = Math.round((g.amount / g.target) * 100);
      });
      
      // 按小组+业务员汇总（算达标人数）
      const THRESHOLD = 100000; // 10万达标
      const personGroupMap = {}; // groupName -> { personName: totalAmount }
      filtered.forEach(d => {
        if (!personGroupMap[d.groupName]) personGroupMap[d.groupName] = {};
        if (!personGroupMap[d.groupName][d.salesperson]) personGroupMap[d.groupName][d.salesperson] = 0;
        personGroupMap[d.groupName][d.salesperson] += d.amount;
      });
      
      // 计算每个组的达标人数和达标率
      Object.keys(groupReport).forEach(name => {
        const persons = personGroupMap[name] || {};
        const totalPersons = Object.keys(persons).length;
        const qualifiedPersons = Object.values(persons).filter(a => a >= THRESHOLD).length;
        groupReport[name].totalPersons = totalPersons;
        groupReport[name].qualifiedPersons = qualifiedPersons;
        groupReport[name].qualificationRate = totalPersons > 0 ? Math.round((qualifiedPersons / totalPersons) * 100) : 0;
      });
      
      // 按日期汇总（每日）
      const dailyMap = {};
      filtered.forEach(d => {
        const dt = new Date(d.time.replace(/\//g, '-'));
        if (!isNaN(dt.getTime())) {
          const ds = (dt.getMonth() + 1) + '/' + dt.getDate();
          dailyMap[ds] = (dailyMap[ds] || 0) + d.amount;
        }
      });
      const dailyReport = Object.keys(dailyMap).sort().map(ds => ({ date: ds, amount: dailyMap[ds] }));
      
      // 总计
      const totalAmount = filtered.reduce((s, d) => s + d.amount, 0);
      const totalDeals = filtered.length;
      const totalTarget = Object.values(groupReport).reduce((s, g) => s + g.target, 0);
      
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        month: month || 'all',
        totalAmount,
        totalDeals,
        totalTarget,
        overallCompletion: totalTarget > 0 ? Math.round((totalAmount / totalTarget) * 100) : 0,
        groups: Object.values(groupReport),
        daily: dailyReport,
        deals: filtered
      }));
    } catch(e) {
      console.error('Error generating report:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '生成报表失败' }));
    }
    return;
  }

  // Static file serving
  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 - 文件未找到</h1>');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected, total:', wss.clients.size);
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected, total:', wss.clients.size);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Server running at http://0.0.0.0:' + PORT + '/');
  console.log('Dashboard: http://192.168.110.18:' + PORT + '/index.html');
  console.log('Input: http://192.168.110.18:' + PORT + '/input.html');
  console.log('Manage: http://192.168.110.18:' + PORT + '/manage.html');
});
