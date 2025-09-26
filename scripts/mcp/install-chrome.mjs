#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);
const CACHE_DIR = path.join(process.cwd(), '.cache', 'chrome-for-testing');

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  const file = await fs.open(dest, 'w');
  try {
    for await (const chunk of res.body) {
      await file.write(chunk);
    }
  } finally {
    await file.close();
  }
}

async function unzip(zipPath, destDir) {
  await ensureDir(destDir);
  await execFileAsync('unzip', ['-q', zipPath, '-d', destDir]);
}

async function main() {
  if (os.platform() !== 'darwin') {
    throw new Error('This installer currently supports macOS only. Please adapt for your platform.');
  }
  console.log('[cft-install] Resolving latest Chrome for Testing version…');
  const versions = await fetchJson('https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json');
  const version = versions?.channels?.Stable?.version;
  if (!version) {
    throw new Error('Unable to determine stable version from chrome-for-testing metadata.');
  }
  console.log(`[cft-install] Latest stable version: ${version}`);
  const archiveName = 'chrome-mac-x64.zip';
  const downloadUrl = `https://storage.googleapis.com/chrome-for-testing-public/${version}/mac-x64/${archiveName}`;
  const versionDir = path.join(CACHE_DIR, version);
  const chromeAppPath = path.join(versionDir, 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
  try {
    await fs.access(chromeAppPath);
    console.log('[cft-install] Chrome for Testing already downloaded.');
    return;
  } catch {
    // need to download
  }

  await ensureDir(versionDir);
  const zipPath = path.join(versionDir, archiveName);
  console.log(`[cft-install] Downloading ${downloadUrl}`);
  await downloadFile(downloadUrl, zipPath);
  console.log('[cft-install] Extracting archive…');
  await unzip(zipPath, versionDir);
  console.log(`[cft-install] Chrome for Testing available at ${chromeAppPath}`);
  console.log('[cft-install] Set CHROME_PATH to this binary or allow scripts/start-chrome-mcp.sh to auto-detect.');
}

main().catch((error) => {
  console.error('[cft-install] Failed:', error.message);
  if (error.cause) {
    console.error('[cft-install] Cause:', error.cause);
  }
  process.exit(1);
});
