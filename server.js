const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3456;
const BASE_DIR = __dirname;
const INDEX_PATH = path.join(BASE_DIR, 'index.html');
const GH_EXE = 'C:/Program Files/GitHub CLI/gh.exe';
const REPO = '2262094142-afk/health-cert';

// MIME types
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

function jsonRes(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
  });
}

// Embed image into DEFAULT_IMAGE in index.html
function embedImageInHtml(base64Image) {
  let html = fs.readFileSync(INDEX_PATH, 'utf8');

  // Replace the DEFAULT_IMAGE value
  const marker = 'var DEFAULT_IMAGE = ';
  const idx = html.indexOf(marker);
  if (idx === -1) {
    return { ok: false, error: 'DEFAULT_IMAGE marker not found in index.html' };
  }

  const start = idx + marker.length;
  // Find the semicolon that ends this statement
  const end = html.indexOf(';', start);
  if (end === -1) {
    return { ok: false, error: 'Could not find end of DEFAULT_IMAGE statement' };
  }

  // Replace value
  html = html.substring(0, start) + JSON.stringify(base64Image) + html.substring(end);

  fs.writeFileSync(INDEX_PATH, html, 'utf8');
  return { ok: true };
}

// Git add, commit, push
function gitPush() {
  try {
    execSync('git add index.html', { cwd: BASE_DIR, stdio: 'pipe' });
    execSync('git commit -m "更新正面健康证图片"', { cwd: BASE_DIR, stdio: 'pipe' });
    execSync(`"${GH_EXE}" auth status`, { cwd: BASE_DIR, stdio: 'pipe' });
    execSync('git push origin main', { cwd: BASE_DIR, stdio: 'pipe', timeout: 30000 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.stderr ? e.stderr.toString() : e.message };
  }
}

const server = http.createServer(async (req, res) => {
  // CORS headers for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: save image
  if (req.method === 'POST' && req.url === '/api/save') {
    const body = await readBody(req);
    try {
      const data = JSON.parse(body);
      const image = data.image || '';

      if (!image || !image.startsWith('data:image/')) {
        jsonRes(res, 400, { ok: false, error: '无效的图片数据' });
        return;
      }

      const embedResult = embedImageInHtml(image);
      if (!embedResult.ok) {
        jsonRes(res, 500, { ok: false, error: embedResult.error });
        return;
      }

      const pushResult = gitPush();
      if (!pushResult.ok) {
        console.error('Git push 失败:', pushResult.error);
        // Still return ok because the file was updated locally
        jsonRes(res, 200, { ok: true, pushed: false, note: '本地已保存，GitHub推送失败，请检查网络后重试' });
        return;
      }

      console.log('图片已保存并推送到 GitHub Pages');
      jsonRes(res, 200, { ok: true, pushed: true, note: '图片已同步到 GitHub Pages，约1分钟后扫码可见' });
      return;
    } catch (e) {
      jsonRes(res, 500, { ok: false, error: e.message });
      return;
    }
  }

  // Serve static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(BASE_DIR, filePath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ========================================');
  console.log('  健康证管理服务已启动');
  console.log('  ');
  console.log('  本地地址: http://localhost:' + PORT);
  console.log('  保存图片: 编辑面板点击"保存修改"');
  console.log('  ========================================');
  console.log('');
});
