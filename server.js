const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 30000;
const DATA_FILE = path.join(__dirname, 'data.json');

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

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
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

  // API: GET /api/data
  if (req.method === 'GET' && url.pathname === '/api/data') {
    try {
      const data = readData();
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
      
      const data = readData();
      const newId = data.deals.length > 0 ? Math.max(...data.deals.map(d => d.id)) + 1 : 1;
      
      const newDeal = {
        id: newId,
        time: dealData.time || new Date().toLocaleString('zh-CN', { hour12: false }),
        groupName: dealData.groupName,
        salesperson: dealData.salesperson,
        amount: dealData.amount
      };
      
      data.deals.unshift(newDeal);
      
      // Update stats
      data.stats.totalAmount += dealData.amount;
      data.stats.totalDeals += 1;
      data.stats.avgDealSize = Math.round(data.stats.totalAmount / data.stats.totalDeals);
      
      // Update group
      const group = data.groups.find(g => g.name === dealData.groupName);
      if (group) {
        group.amount += dealData.amount;
        const target = group.target || 500000;
        group.completionRate = Math.round((group.amount / target) * 100);
      }
      
      // Update daily stats
      const dealTime = dealData.time ? new Date(dealData.time.replace(/\//g, '-')) : new Date();
      if (!isNaN(dealTime.getTime())) {
        const todayStr = (dealTime.getMonth() + 1) + '/' + dealTime.getDate();
        let todayStat = data.dailyStats.find(d => d.date === todayStr);
        if (todayStat) {
          todayStat.amount += dealData.amount;
        } else {
          data.dailyStats.push({ date: todayStr, amount: dealData.amount });
        }
        if (data.dailyStats.length > 7) data.dailyStats = data.dailyStats.slice(-7);
      }
      
      writeData(data);
      
      // Broadcast to WebSocket clients
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
      
      const data = readData();
      const deal = data.deals.find(d => d.id === id);
      if (!deal) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '成单不存在' }));
        return;
      }
      
      // If changing group or amount, recalculate
      const oldGroup = deal.groupName;
      const oldAmount = deal.amount;
      
      if (updateData.groupName) deal.groupName = updateData.groupName;
      if (updateData.salesperson) deal.salesperson = updateData.salesperson;
      if (updateData.amount) deal.amount = updateData.amount;
      
      // Recalculate group amounts
      if (oldGroup !== deal.groupName || oldAmount !== deal.amount) {
        // Remove from old group
        const oldG = data.groups.find(g => g.name === oldGroup);
        if (oldG) {
          oldG.amount -= oldAmount;
          const target = oldG.target || 500000;
          oldG.completionRate = Math.round((oldG.amount / target) * 100);
        }
        // Add to new group
        const newG = data.groups.find(g => g.name === deal.groupName);
        if (newG) {
          newG.amount += deal.amount;
          const target = newG.target || 500000;
          newG.completionRate = Math.round((newG.amount / target) * 100);
        }
      }
      
      writeData(data);
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
      const data = readData();
      const dealIndex = data.deals.findIndex(d => d.id === id);
      
      if (dealIndex === -1) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '成单不存在' }));
        return;
      }
      
      const deal = data.deals[dealIndex];
      data.deals.splice(dealIndex, 1);
      
      // Update stats
      data.stats.totalAmount -= deal.amount;
      data.stats.totalDeals -= 1;
      if (data.stats.totalDeals > 0) {
        data.stats.avgDealSize = Math.round(data.stats.totalAmount / data.stats.totalDeals);
      } else {
        data.stats.avgDealSize = 0;
      }
      
      // Update group
      const group = data.groups.find(g => g.name === deal.groupName);
      if (group) {
        group.amount -= deal.amount;
        const target = group.target || 500000;
        group.completionRate = Math.round((group.amount / target) * 100);
      }
      
      // Update dailyStats: recalculate from remaining deals
      data.dailyStats = [];
      const dateMap = {};
      data.deals.forEach(d => {
        const dt = new Date(d.time);
        if (!isNaN(dt.getTime())) {
          const ds = (dt.getMonth() + 1) + '/' + dt.getDate();
          dateMap[ds] = (dateMap[ds] || 0) + d.amount;
        }
      });
      Object.keys(dateMap).forEach(ds => {
        data.dailyStats.push({ date: ds, amount: dateMap[ds] });
      });
      data.dailyStats.sort((a,b) => a.date.localeCompare(b.date));
      if (data.dailyStats.length > 7) data.dailyStats = data.dailyStats.slice(-7);
      
      writeData(data);
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
      
      const data = readData();
      const group = data.groups.find(g => g.name === groupName);
      
      if (!group) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '小组不存在' }));
        return;
      }
      
      group.target = body.target;
      group.completionRate = Math.round((group.amount / group.target) * 100);
      
      writeData(data);
      broadcast({ type: 'update_target', group: group });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, group: group }));
    } catch(e) {
      console.error('Error setting target:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '服务器错误' }));
    }
    return;
  }

  // API: GET /api/report?month=2026-05 - 月报表
  if (req.method === 'GET' && url.pathname === '/api/report') {
    try {
      const month = url.searchParams.get('month') || '';
      const data = readData();
      
      // 筛选指定月份的成单
      let filtered = data.deals;
      if (month) {
        filtered = data.deals.filter(d => {
          const dt = new Date(d.time.replace(/\//g, '-'));
          if (isNaN(dt.getTime())) return false;
          const m = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
          return m === month;
        });
      }
      
      // 按小组汇总
      const groupReport = {};
      data.groups.forEach(g => {
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
