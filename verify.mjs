import './mute-auto.mjs'
import { chromium, webkit } from 'playwright'
import { serve } from './server.mjs'
const [,, GAME = 'ufo-smash', BR = 'chromium,webkit', VPS = '360x640,390x844,430x932'] = process.argv
const PORT = 6900 + Math.floor(Math.random() * 90)
const srv = await serve(PORT)
const base = s => `http://localhost:${PORT}/play/${s}/`
const SHOT = new URL('./shots/', import.meta.url).pathname; (await import('node:fs')).mkdirSync(SHOT, { recursive: true })
const out = []
const vis = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 }, sel)
async function tap(p, sel) { const b = await p.locator(sel).boundingBox(); if (!b) throw new Error('no box ' + sel); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2) }
async function waitFor(p, fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return Date.now() - t0; await p.waitForTimeout(250) } return -1 }
async function overflow(p) { return p.evaluate(() => { const bad = []; for (const e of document.querySelectorAll('button,a,h1,h2,p,.big,#tmSupport,#tmHome')) { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width === 0 || cs.visibility === 'hidden') continue; let n = e, hidden = false; while (n && n !== document.body) { if (getComputedStyle(n).display === 'none') { hidden = true; break } n = n.parentElement } if (hidden) continue; if (r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1) bad.push((e.id || e.tagName) + ':' + Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.right) + ',' + Math.round(r.bottom)) } return bad }) }

const GAMES = {
  'ufo-smash': { ready: '__ufoReady', async play(p) {
    await tap(p, '#startBtn'); await p.waitForTimeout(800)
    const c = await p.locator('#game').boundingBox()
    // 本物の操作: パチンコを引いて離す（マウスで canvas に）。何発か撃つ
    for (let i = 0; i < 3; i++) { const sx = c.x + c.width / 2, sy = c.y + c.height * 0.83; await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(sx + (i - 1) * 20, sy + 60, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(700) }
    const t = await waitFor(p, () => vis(p, '#gameover:not(.hidden) .panel'), 240000)
    return { overMs: t }
  }, async after(p) { await tap(p, '#retryBtn'); await p.waitForTimeout(500); return !(await vis(p, '#gameover:not(.hidden) .panel')) } },
  'draw-bounce': { ready: '__dbReady', async play(p) {
    await tap(p, '#startBtn'); await p.waitForTimeout(600)
    const vw = p.viewportSize()
    // 線を1本描く（pointer）
    await p.mouse.move(vw.width * 0.3, vw.height * 0.75); await p.mouse.down(); await p.mouse.move(vw.width * 0.7, vw.height * 0.75, { steps: 8 }); await p.mouse.up()
    const t = await waitFor(p, () => p.evaluate(() => document.getElementById('overlay').classList.contains('result') && !document.getElementById('overlay').classList.contains('hide')), 120000)
    await p.waitForTimeout(900)
    return { overMs: t }
  }, async after(p) { await tap(p, '#startBtn'); await p.waitForTimeout(500); return p.evaluate(() => document.getElementById('overlay').classList.contains('hide')) } },
  'traffic-ojisan': { ready: '__toReady', async play(p) {
    if (await vis(p, '#daily:not(.hidden) #dailyOk')) await tap(p, '#dailyOk')
    await p.waitForTimeout(300)
    await tap(p, '#startBtn'); await p.waitForTimeout(1500)
    // 本物の操作: 画面上部から左右のレーンへ何回かドラッグ
    const c = await p.locator('canvas').first().boundingBox()
    for (let i = 0; i < 4; i++) { const x = c.x + c.width * (0.4 + 0.2 * (i % 2)), y = c.y + c.height * 0.3; await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(c.x + c.width * (i % 2 ? 0.25 : 0.75), c.y + c.height * 0.8, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(900) }
    const t = await waitFor(p, () => vis(p, '#gameover:not(.hidden)'), 240000)
    await p.waitForTimeout(900)
    return { overMs: t }
  }, async after(p) { await tap(p, '#goHome'); await p.waitForTimeout(500); return vis(p, '#home:not(.hidden)') } },
}

async function run(bt, name, slug, vp) {
  const g = GAMES[slug]; const [w, h] = vp.split('x').map(Number)
  const b = await bt.launch()
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: name === 'chromium' && w < 800, deviceScaleFactor: 2, locale: 'ja-JP' })
  await ctx.route('https://apps.apple.com/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>store</title>' }))
  const p = await ctx.newPage()
  const errs = [], bad = []
  p.on('pageerror', e => errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()) })
  p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()) })
  p.on('requestfailed', r => { const u = r.url(); if (!/googletagmanager|fonts\.g/.test(u) && !/ERR_ABORTED|cancelled/i.test(r.failure()?.errorText || '')) bad.push('fail ' + u + ' ' + r.failure()?.errorText) })
  await p.goto(base(slug), { waitUntil: 'load' })
  const ready = await p.waitForFunction(f => !!window[f], g.ready, { timeout: 15000 }).then(() => true, () => false)
  await p.waitForTimeout(1200)
  const tag = `${slug}_${name}_${vp}`
  await p.screenshot({ path: SHOT + tag + '_home.png' })
  const ovHome = await overflow(p)
  const r = await g.play(p)
  await p.screenshot({ path: SHOT + tag + '_over.png' })
  const ovOver = await overflow(p)
  const sup = await vis(p, '#tmSupport'), home = await vis(p, '#tmHome')
  const supTxt = await p.evaluate(() => (document.getElementById('tmSupport') || {}).textContent + ' / ' + (document.getElementById('tmHome') || {}).textContent)
  // iPhone アプリ版ボタン: 見える・リンク先・新しいタブ・主ボタンと離れている・押すと計測とストアのタブ
  const MAIN = { 'ufo-smash': '#retryBtn', 'draw-bounce': '#startBtn', 'traffic-ojisan': '#goHome' }[slug]
  const appVis = await vis(p, '#tmApp')
  const app = await p.evaluate(m => { const a = document.getElementById('tmApp'), b = document.querySelector(m); if (!a) return null; const r = a.getBoundingClientRect(), q = b.getBoundingClientRect(); const gx = Math.max(0, q.left - r.right, r.left - q.right), gy = Math.max(0, q.top - r.bottom, r.top - q.bottom); return { href: a.getAttribute('href'), target: a.target, rel: a.rel, txt: a.textContent, h: Math.round(r.height), w: Math.round(r.width), mainH: Math.round(q.height), gap: Math.round(Math.max(gx, gy)) } }, MAIN)
  let appPop = ''
  if (appVis) { const pop = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null); await tap(p, '#tmApp'); const np = await pop; if (np) { appPop = np.url(); await np.close() } }
  const tm = await p.evaluate(() => (window.__tmLog || []).map(x => x.name).join(','))
  const again = await g.after(p)
  await p.waitForTimeout(300)
  out.push({ tag, ready, ...r, sup, home, supTxt, appVis, app, appPop, tm, again, errs, bad, ovHome, ovOver })
  console.log(JSON.stringify(out.at(-1)))
  await b.close()
}
const tasks = []
for (const slug of GAME === 'all' ? Object.keys(GAMES) : GAME.split(',')) for (const name of BR.split(',')) for (const vp of VPS.split(',')) tasks.push([name === 'webkit' ? webkit : chromium, name, slug, vp])
// Android の UA ではアプリ版ボタンを出さない（入れられないため）
for (const slug of GAME === 'all' ? Object.keys(GAMES) : GAME.split(',')) {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', locale: 'ja-JP' })
  const p = await ctx.newPage(); await p.goto(base(slug), { waitUntil: 'load' }); await p.waitForFunction(f => !!window[f], GAMES[slug].ready, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(800)
  const r = await p.evaluate(() => ({ app: !!document.getElementById('tmApp'), support: !!document.getElementById('tmSupport') }))
  console.log(JSON.stringify({ android: slug, ...r, ok: !r.app && r.support })); await b.close()
}
// 2本ずつ並列（重い検査は同時に2本まで）
for (let i = 0; i < tasks.length; i += 2) await Promise.all(tasks.slice(i, i + 2).map(t => run(...t).catch(e => { console.log('ERR', t[1], t[2], t[3], e.message); out.push({ tag: t.slice(1).join('_'), fatal: e.message }) })))
console.log('SERVER 404:', JSON.stringify(srv.miss))
srv.close()
