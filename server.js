const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] ? path.join(__dirname, process.argv[2]) : __dirname);
const PORT = Number(process.env.PORT || 3000);
const manifestPath = path.join(__dirname, 'siteclone.manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { resources: {} };
const routeMap = new Map();
for (const r of Object.values(manifest.resources || {})) {
  if (r.publicPath && r.localPath) routeMap.set(r.publicPath, r.localPath);
}

const mime = {
  '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.ico':'image/x-icon',
  '.svg':'image/svg+xml', '.woff2':'font/woff2', '.wav':'audio/wav', '.m4a':'audio/mp4', '.mp4':'video/mp4', '.bin':'application/octet-stream'
};

function clean(p) {
  const n = path.posix.normalize(decodeURIComponent(p)).replace(/^\/+/, '');
  if (n.startsWith('..')) return null;
  return n;
}

function resolveRequest(reqUrl) {
  const u = new URL(reqUrl, 'http://local.invalid');
  const exact = u.pathname + u.search;
  const mapped = routeMap.get(exact) || routeMap.get(u.pathname);
  if (mapped) return path.join(__dirname, mapped);
  let rel = clean(u.pathname);
  if (rel === null) return null;
  if (!rel || rel.endsWith('/')) rel += 'index.html';
  return path.join(ROOT, rel);
}

function send(req, res, file) {
  if (!file || !file.startsWith(ROOT) && !file.startsWith(__dirname)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not Found'); }
    const ext = path.extname(file).toLowerCase();
    const type = mime[ext] || 'application/octet-stream';
    const range = req.headers.range;
    res.setHeader('Content-Type', type);
    res.setHeader('Accept-Ranges', 'bytes');
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (m) {
        let start = m[1] ? Number(m[1]) : 0;
        let end = m[2] ? Number(m[2]) : st.size - 1;
        if (!m[1] && m[2]) { const n = Number(m[2]); start = Math.max(0, st.size - n); end = st.size - 1; }
        if (start <= end && end < st.size) {
          res.writeHead(206, {'Content-Range':`bytes ${start}-${end}/${st.size}`,'Content-Length':end-start+1});
          return fs.createReadStream(file,{start,end}).pipe(res);
        }
      }
      res.writeHead(416, {'Content-Range':`bytes */${st.size}`}); return res.end();
    }
    res.writeHead(200, {'Content-Length': st.size});
    fs.createReadStream(file).pipe(res);
  });
}

http.createServer((req,res)=>send(req,res,resolveRequest(req.url))).listen(PORT,'0.0.0.0',()=>console.log(`Jeffsite exact capture: http://localhost:${PORT}`));
