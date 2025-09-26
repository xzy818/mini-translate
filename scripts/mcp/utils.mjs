#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let patchAttempted = false;

export async function ensureChromeDevtoolsPatch() {
  if (patchAttempted) return;
  patchAttempted = true;
  let pkgUrl;
  try {
    const pkgPath = require.resolve('chrome-devtools-mcp/package.json');
    pkgUrl = pathToFileURL(pkgPath).href;
  } catch (error) {
    console.warn('[mcp-utils] Unable to resolve chrome-devtools-mcp package:', error.message);
    return;
  }
  const pkgDir = path.dirname(fileURLToPath(pkgUrl));
  const browserJsPath = path.join(pkgDir, 'build/src/browser.js');
  let source;
  try {
    source = await fs.readFile(browserJsPath, 'utf8');
  } catch (error) {
    console.warn('[mcp-utils] Unable to read chrome-devtools-mcp browser.js:', error.message);
    return;
  }
  if (!source.includes("'chrome-extension://'")) {
    return;
  }
  const patched = source.replace(/\s*'chrome-extension:\/\/'?,?\n/, '\n');
  if (patched === source) {
    console.warn('[mcp-utils] chrome-devtools-mcp patch unsuccessful (pattern not found).');
    return;
  }
  await fs.writeFile(browserJsPath, patched, 'utf8');
  console.log('[mcp-utils] Patched chrome-devtools-mcp to allow chrome-extension:// pages.');
}
