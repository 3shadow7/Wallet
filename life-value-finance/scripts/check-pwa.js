const urls = [
  'http://localhost:4400/manifest.webmanifest',
  'http://localhost:4400/ngsw-worker.js',
  'http://localhost:4400/ngsw.json'
];

(async () => {
  try {
    for (const url of urls) {
      const res = await fetch(url, { method: 'HEAD' });
      console.log(url, res.status, res.statusText);
      if (!res.ok) process.exitCode = 2;
    }
    if (process.exitCode !== 2) console.log('All PWA endpoints returned OK');
  } catch (e) {
    console.error('Failed to check PWA endpoints', e);
    process.exitCode = 3;
  }
})();
