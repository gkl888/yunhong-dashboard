const lt = require('localtunnel');
const fs = require('fs');
const path = require('path');

const PORT = 30000;
const URL_FILE = path.join(__dirname, 'tunnel-url.txt');

async function startTunnel() {
    try {
        const tunnel = await lt(PORT);
        const url = 'https://' + tunnel.url;
        
        // 写入URL文件
        fs.writeFileSync(URL_FILE, url + '\n', 'utf8');
        console.log('================================');
        console.log('  Tunnel URL: ' + url);
        console.log('  Local: http://localhost:' + PORT);
        console.log('================================');
        
        tunnel.on('close', () => {
            console.log('Tunnel closed. Reconnecting in 5s...');
            setTimeout(startTunnel, 5000);
        });
        
        tunnel.on('error', (err) => {
            console.error('Tunnel error:', err.message);
            setTimeout(startTunnel, 10000);
        });
    } catch (err) {
        console.error('Failed to start tunnel:', err.message);
        setTimeout(startTunnel, 10000);
    }
}

startTunnel();
