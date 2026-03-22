#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const srcRoot = path.join(projectRoot, 'src');

// Files where hex literals are intentional (design tokens, assets, fallbacks).
const allowlist = new Set([
  path.join(srcRoot, 'app', 'theme', '_variables.scss'),
  path.join(srcRoot, 'app', 'theme', '_assets-3d.scss'),
  path.join(srcRoot, 'app', 'theme', 'theme-utils.ts'),
  path.join(srcRoot, 'assets', 'icons', 'icon-512.svg'),
  path.join(srcRoot, 'assets', 'icons', 'icon-192.svg'),
  path.join(srcRoot, 'manifest.webmanifest'),
  path.join(srcRoot, 'index.html'),
]);

const ignoreDirs = new Set(['node_modules', 'dist', '.angular']);
const hexRegex = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const work = entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) return;
      return walk(fullPath);
    }
    if (!entry.isFile()) return;
    if (allowlist.has(fullPath)) return;

    const content = await fs.readFile(fullPath, 'utf8');
    if (!hexRegex.test(content)) return;

    // Re-run regex to collect exact positions after lastIndex move.
    hexRegex.lastIndex = 0;
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      hexRegex.lastIndex = 0;
      if (hexRegex.test(line)) {
        findings.push({ file: fullPath, line: idx + 1, text: line.trim() });
      }
    });
  });
  await Promise.all(work);
}

const findings = [];

(async () => {
  await walk(srcRoot);

  if (findings.length === 0) {
    console.log('✓ No disallowed hex literals found.');
    return;
  }

  console.error('Hex literals are blocked. Please replace with tokens or CSS variables.');
  findings
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
    .forEach((f) => {
      const rel = path.relative(projectRoot, f.file).replace(/\\/g, '/');
      console.error(`  ${rel}:${f.line} ${f.text}`);
    });
  process.exitCode = 1;
})();
