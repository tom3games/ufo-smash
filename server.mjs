import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'
const ROOT = path.join(process.env.HOME, 'Desktop/claudecode')
const SLUGS = ['ufo-smash', 'draw-bounce', 'traffic-ojisan']
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.json': 'application/json' }
export function serve(port) {
  const miss = []
  const s = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    const m = u.match(/^\/play\/([^/]+)\/(.*)$/)
    if (!m || !SLUGS.includes(m[1])) { miss.push(u); res.writeHead(404); return res.end() }
    let f = path.join(ROOT, m[1], m[2] || 'index.html')
    if (!f.startsWith(path.join(ROOT, m[1])) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { miss.push(u); res.writeHead(404); return res.end() }
    const data = fs.readFileSync(f)
    const range = req.headers.range
    const type = TYPES[path.extname(f)] || 'application/octet-stream'
    if (range) { const [a, b] = range.replace('bytes=', '').split('-'); const st = +a, en = b ? +b : data.length - 1
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${st}-${en}/${data.length}`, 'Accept-Ranges': 'bytes', 'Content-Length': en - st + 1 }); return res.end(data.subarray(st, en + 1)) }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': data.length, 'Accept-Ranges': 'bytes' }); res.end(data)
  })
  return new Promise(r => s.listen(port, () => r({ close: () => s.close(), miss })))
}
