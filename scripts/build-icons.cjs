const { chromium } = require('playwright'); const fs = require('fs');
// 產生所有 App 圖示：node scripts/build-icons.cjs（需要 playwright）
const path = require('path');
const OUT = path.join(__dirname, '..', 'public');
const INK = '#1E2A44', Y = '#F2C14E', PAPER = '#F4F6F9';
const PLANE = "<path d=\"M0 -21C3 -21 4.5 -18 4.5 -14V-5L20 4V9.5L4.5 4.5V12L10 16V20.5L0 18L-10 20.5V16L-4.5 12V4.5L-20 9.5V4L-4.5 -5V-14C-4.5 -18 -3 -21 0 -21Z\" fill=\"CUR\" stroke=\"CUR\" stroke-width=\"1.5\" stroke-linejoin=\"round\"/>";
const cx = 51, cy = 53, r = 28, a0 = -30, a1 = 200, ap = 236;
const pt = (a) => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)].map((v) => +v.toFixed(1));
const head = Math.atan2(Math.cos(ap * Math.PI / 180), -Math.sin(ap * Math.PI / 180)) * 180 / Math.PI;
const [sx, sy] = pt(a0), [ex, ey] = pt(a1), [px, py] = pt(ap);
const glyph = (fg, c) => `<path d="M${sx} ${sy}A${r} ${r} 0 1 1 ${ex} ${ey}" fill="none" stroke="${fg}" stroke-width="7" stroke-linecap="round" stroke-dasharray="8 13"/><g transform="translate(${px} ${py}) rotate(${(head + 90).toFixed(1)}) scale(1.05)">${PLANE.replaceAll('CUR', c)}</g>`;
const svg = (inner, bg, rx = 0, scale = 1) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${bg ? `<rect width="100" height="100"${rx ? ` rx="${rx}"` : ''} fill="${bg}"/>` : ''}${scale === 1 ? inner : `<g transform="translate(50 50) scale(${scale}) translate(-50 -50)">${inner}</g>`}</svg>`;
const files = {
  'icon.svg': svg(glyph(PAPER, Y), INK, 22),                 // favicon／一般用（圓角）
  'icon-square.svg': svg(glyph(PAPER, Y), INK),               // 滿版，給系統自行裁圓角
  'icon-maskable.svg': svg(glyph(PAPER, Y), INK, 0, 0.8),     // 圖形縮進安全區（直徑 80%）
  'icon-mono-light.svg': svg(glyph(INK, INK)),                // 淺色底用：深藍單色
  'icon-mono-dark.svg': svg(glyph('#FFFFFF', '#FFFFFF')),     // 深色底用：白色單色
};
for (const [n, s] of Object.entries(files)) fs.writeFileSync(OUT + '/' + n, s);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  for (const [n, size, src] of [['icon-1024.png', 1024, 'icon-square.svg'], ['icon-512.png', 512, 'icon-square.svg'], ['icon-192.png', 192, 'icon-square.svg'], ['icon-maskable-512.png', 512, 'icon-maskable.svg'], ['apple-touch-icon.png', 180, 'icon-square.svg'], ['favicon-32.png', 32, 'icon.svg'], ['favicon-16.png', 16, 'icon.svg']]) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<body style="margin:0;background:transparent">${files[src].replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
    await p.screenshot({ path: OUT + '/' + n, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  }
  await b.close();
})();
