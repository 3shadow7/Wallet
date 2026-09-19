// a simple script to generate all the PNG icons from a single SVG source file
// and then bundle the 16/32/48 sizes into a single favicon.ico file for legacy browsers
// and run it with `node generate-icons.js` from the Qeeva-Frontend root directory

const sharp = require('sharp');
const fs = require('fs');

const src = 'public/favicon.svg';       // adjust path if it's not in the project root
const outDir = 'public/icons';

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const sizes = [
  // size,  used for
  [16,  'browser tab favicon (small)'],
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

(async () => {
  for (const [size, usage] of sizes) {
    const name = `icon-${size}.png`;
    await sharp(src).resize(size, size).png().toFile(`${outDir}/${name}`);
    console.log(`✓ ${name.padEnd(16)} — ${usage}`);
  }

  // Maskable version: logo shrunk to ~80% with padding, since Android
  // crops this one to a circle/squircle depending on the launcher.
  const pad = Math.round(512 * 0.1);
  const inner = 512 - pad * 2;
  const logo = await sharp(src).resize(inner, inner).png().toBuffer();

  await sharp({
    create: { width: 512, height: 512, channels: 4, background: '#0f0f0f' }
  })
    .composite([{ input: logo, top: pad, left: pad }])
    .png()
    .toFile(`${outDir}/icon-512-maskable.png`);
  console.log('✓ icon-512-maskable.png — PWA manifest, purpose:"maskable" (Android adaptive icon)');
})();
