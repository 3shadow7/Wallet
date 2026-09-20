// generate-icons.js
// Generates all PNG icon sizes + favicon.ico from a single Figma-exported SVG.
// Uses Puppeteer (real Chromium) instead of sharp/librsvg, because this SVG
// relies on conic-gradient + backdrop-filter inside <foreignObject> elements,
// which only a real browser engine can render — librsvg renders them as
// solid black/transparent.
//
// Run with: node generate-icons.js
// (from the Qeeva-Frontend root directory)
//
// Requires: npm i -D puppeteer png-to-ico

const puppeteer = require('puppeteer');
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default || pngToIcoModule;
const fs = require('fs');

const src = 'public/favicon.svg';      // adjust path if it's not in the project root
const outDir = 'public/icons';
let svgContent = fs.readFileSync(src, 'utf8');

// Strip hardcoded width/height so the SVG scales to fill its container
// via viewBox instead of rendering at its native pixel size and clipping.
svgContent = svgContent.replace(/<svg([^>]*)\swidth="[^"]*"/, '<svg$1')
                       .replace(/<svg([^>]*)\sheight="[^"]*"/, '<svg$1');
svgContent = svgContent.replace('<svg', '<svg width="100%" height="100%"');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const sizes = [
  // size,  used for
  [16,  'browser tab favicon (small) + packed into favicon.ico'],
  [32,  'browser tab favicon (standard) + packed into favicon.ico'],
  [48,  'browser tab favicon (high-DPI) + packed into favicon.ico'],
  [120, 'iOS home screen icon — older iPhones'],
  [150, 'Windows Start menu tile (mstile)'],
  [152, 'iOS home screen icon — iPad'],
  [180, 'iOS home screen icon — modern iPhones (apple-touch-icon)'],
  [192, 'Android home screen icon / PWA manifest minimum'],
  [256, 'PWA manifest — general midsize install icon'],
  [384, 'PWA manifest — used in some splash screen calculations'],
  [512, 'PWA manifest — splash screen + Play Store style install prompt'],
];

async function renderSvgAt(page, size) {
  const html = `
    <html><body style="margin:0;padding:0;background:transparent;">
      <div style="width:${size}px;height:${size}px;display:flex;">${svgContent}</div>
    </body></html>`;
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 2 });
  await page.setContent(html);
  const el = await page.$('div');
  return el.screenshot({ omitBackground: true });
}

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // 1) Generate every standard icon size
  for (const [size, usage] of sizes) {
    const name = `icon-${size}.png`;
    const buffer = await renderSvgAt(page, size);
    fs.writeFileSync(`${outDir}/${name}`, buffer);
    console.log(`✓ ${name.padEnd(16)} — ${usage}`);
  }

  // 2) Maskable icon: logo shrunk with padding on a solid white background,
  // since Android crops maskable icons to a circle/squircle and transparent
  // padding gets filled with a launcher-default color otherwise.
  const canvas = 512;
  const paddingPercent = 0.20;          // logo occupies ~60% of canvas
  const pad = Math.round(canvas * paddingPercent);
  const inner = canvas - pad * 2;

  const logoHtml = `
    <html><body style="margin:0;padding:0;">
      <div style="
        width:${canvas}px;height:${canvas}px;
        background:#ffffff;
        display:flex;align-items:center;justify-content:center;
      ">
        <div style="width:${inner}px;height:${inner}px;">${svgContent}</div>
      </div>
    </body></html>`;

  await page.setViewport({ width: canvas, height: canvas, deviceScaleFactor: 2 });
  await page.setContent(logoHtml);
  const maskEl = await page.$('body > div');
  const maskBuffer = await maskEl.screenshot();
  fs.writeFileSync(`${outDir}/icon-512-maskable.png`, maskBuffer);
  console.log('✓ icon-512-maskable.png — PWA manifest, purpose:"maskable" (white padded background)');

  await browser.close();

  // 3) Pack the 16/32/48 PNGs into a single favicon.ico for legacy browsers
  const icoBuffer = await pngToIco([
    `${outDir}/icon-16.png`,
    `${outDir}/icon-32.png`,
    `${outDir}/icon-48.png`,
  ]);
  fs.writeFileSync('public/favicon.ico', icoBuffer);
  console.log('✓ favicon.ico          — legacy fallback for Safari + old browsers');

  console.log('\nAll icons generated successfully.');
})();
