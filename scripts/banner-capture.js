const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const [theme, outDir, mode = 'full'] = process.argv.slice(2);
const W = 1000, H = 200, FPS = 12, DT = 1000 / FPS;
const NAME = 'Joe Zhuo', SUB = 'C++ / CUDA inference';
const BLINK = 6, FADE = 8;

function timeline() {
  const f = [];
  const hold = (a, b, line, n) => { for (let i = 0; i < n; i++) f.push([a, b, line, Math.floor(i / BLINK) % 2 === 0]); };
  hold(NAME, SUB, 1, 30);
  for (let n = SUB.length - 1; n >= 0; n--) f.push([NAME, SUB.slice(0, n), 1, true]);
  for (let n = NAME.length - 1; n >= 0; n--) f.push([NAME.slice(0, n), '', 0, true]);
  hold('', '', 0, 6);
  for (let n = 1; n <= NAME.length; n++) f.push([NAME.slice(0, n), '', 0, true], [NAME.slice(0, n), '', 0, true]);
  hold(NAME, '', 0, 6);
  for (let n = 1; n <= SUB.length; n++) f.push([NAME, SUB.slice(0, n), 1, true]);
  hold(NAME, SUB, 1, 12);
  return f;
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: 640, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
  await page.evaluateOnNewDocument(() => {
    let t = 0, id = 0;
    let q = new Map();
    const d0 = Date.now();
    performance.now = () => t;
    Date.now = () => d0 + t;
    window.requestAnimationFrame = cb => { q.set(++id, cb); return id; };
    window.cancelAnimationFrame = i => q.delete(i);
    window.__step = dt => { t += dt; const cur = q; q = new Map(); cur.forEach(cb => cb(t)); };
  });
  await page.goto('https://llm-inference-engine-jz.vercel.app', { waitUntil: 'networkidle0' });
  await page.evaluate(th => {
    document.documentElement.dataset.theme = th;
    document.documentElement.style.colorScheme = th;
  }, theme);
  await new Promise(r => setTimeout(r, 1500));
  for (let i = 0; i < 300; i++) await page.evaluate(dt => window.__step(dt), DT);

  const clip = await page.evaluate((W, H) => {
    const c = document.querySelector('canvas');
    const hero = c.parentElement;
    [...hero.children].slice(1).forEach(e => (e.style.visibility = 'hidden'));
    const fg = getComputedStyle(document.querySelector('h1')).color;
    const bg = getComputedStyle(hero).backgroundColor;
    const r = c.getBoundingClientRect();
    const top = Math.round(r.top + (r.height - H) / 2);
    const wrap = document.createElement('div');
    wrap.style.cssText = `position:fixed;left:0;top:${top}px;width:${W}px;height:${H}px;pointer-events:none;
      background:linear-gradient(90deg, ${bg} 0%, ${bg.replace('rgb', 'rgba').replace(')', ',0.85)')} 55%, transparent 90%);
      display:flex;flex-direction:column;justify-content:center;padding-left:56px;box-sizing:border-box;z-index:99`;
    const cur = (id, h) => `<span id="${id}" style="display:inline-block;width:3px;height:${h}px;margin-left:5px;vertical-align:middle;background:${fg}"></span>`;
    wrap.innerHTML = `<div style="height:84px;display:flex;align-items:center"><span id="tw0" style="font-family:'Instrument Serif',Georgia,serif;font-size:84px;line-height:1;color:${fg};white-space:pre"></span>${cur('cur0', 66)}</div>
      <div style="height:34px;display:flex;align-items:center;margin-top:8px;opacity:.7"><span id="tw1" style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:26px;letter-spacing:.02em;color:${fg};white-space:pre"></span>${cur('cur1', 26)}</div>`;
    document.body.appendChild(wrap);
    return { x: 0, y: top, width: W, height: H };
  }, W, H);
  await page.evaluate(() => document.fonts.ready);

  const frames = mode === 'probe' ? [[NAME, SUB, 1, true]] : timeline();
  const total = frames.length + (mode === 'probe' ? 0 : FADE);
  for (let i = 0; i < total; i++) {
    const fr = frames[i % frames.length];
    await page.evaluate(([a, b, line, on], dt) => {
      document.getElementById('tw0').textContent = a;
      document.getElementById('tw1').textContent = b;
      document.getElementById('cur0').style.visibility = on && line === 0 ? 'visible' : 'hidden';
      document.getElementById('cur1').style.visibility = on && line === 1 ? 'visible' : 'hidden';
      window.__step(dt);
    }, fr, DT);
    await page.screenshot({ path: path.join(outDir, String(i).padStart(4, '0') + '.png'), clip, captureBeyondViewport: false });
  }
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({ n: frames.length, fade: FADE, fps: FPS }));
  await browser.close();
})();
