#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ensureChromeDevtoolsPatch } from './utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BROWSER_URL = 'http://127.0.0.1:9222';
const DEFAULT_CONFIG = path.resolve(process.cwd(), 'config/mcp-uid-targets.json');
const DEFAULT_OUTPUT = path.resolve(process.cwd(), 'tests/mcp/batches/uids.json');
const DEFAULT_EXTENSION_ID = 'acfpkkkhehadjlkdnffdkoilmhchefbl';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    switch (key) {
      case 'ext-id':
        args.extId = next;
        i++;
        break;
      case 'browser-url':
        args.browserUrl = next;
        i++;
        break;
      case 'config':
        args.configPath = next;
        i++;
        break;
      case 'output':
        args.outputPath = next;
        i++;
        break;
      case 'verify-only':
        args.verifyOnly = true;
        break;
      case 'update':
        args.update = true;
        break;
      case 'write-batches':
        args.writeBatches = true;
        break;
      case 'help':
        args.help = true;
        break;
      default:
        throw new Error(`Unknown flag: --${key}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/mcp/capture-uids.mjs [options]\n\n`
    + `Options:\n`
    + `  --ext-id <id>           Explicit extension id. If omitted the script attempts auto-discovery.\n`
    + `  --browser-url <url>     Chrome remote debugging URL (default ${DEFAULT_BROWSER_URL}).\n`
    + `  --config <path>         Target descriptor config (default config/mcp-uid-targets.json).\n`
    + `  --output <path>         UID map output path (default tests/mcp/batches/uids.json).\n`
    + `  --verify-only           Only verify targets can be resolved; do not write output.\n`
    + `  --update                Allow overwriting existing output file (default behaviour).\n`
    + `  --write-batches         After capture, update batch JSON via apply-uids script.\n`
    + `  --help                  Show this message.\n`);
}

function normalizeBrowserUrl(url) {
  const trimmed = url.replace(/\/$/, '');
  return trimmed;
}

async function fetchJson(url) {
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Request failed ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

async function ensureInspectablePage(browserUrl) {
  const listUrl = `${browserUrl}/json/list`;
  const list = await fetchJson(listUrl);
  const hasPage = list.some((target) => target.type === 'page' && target.url && !target.url.startsWith('chrome://'));
  if (hasPage) {
    return;
  }
  const newUrl = `${browserUrl}/json/new?https://example.com/`;
  const res = await fetch(newUrl, { method: 'PUT' });
  if (!res.ok) {
    throw new Error(`Unable to create initial tab via ${newUrl}: ${res.status} ${res.statusText}`);
  }
  await delay(500);
}

async function discoverExtensionId(browserUrl, explicitId) {
  if (explicitId) return explicitId;
  const list = await fetchJson(`${browserUrl}/json/list`);
  const idFromServiceWorker = list
    .map((target) => target.url)
    .filter(Boolean)
    .map((url) => {
      const match = url.match(/^chrome-extension:\/\/([^\/]*)\//);
      return match ? match[1] : null;
    })
    .find(Boolean);
  if (idFromServiceWorker) {
    return idFromServiceWorker;
  }
  if (process.env.MCP_EXTENSION_ID) {
    console.warn('[capture-uids] Falling back to MCP_EXTENSION_ID environment variable');
    return process.env.MCP_EXTENSION_ID;
  }
  console.warn('[capture-uids] Unable to detect extension id; using default manifest key derived id.');
  return DEFAULT_EXTENSION_ID;
}

function parsePagesText(text) {
  const lines = text.split('\n').filter((line) => /^\d+:/.test(line));
  return lines.map((line) => {
    const match = line.match(/^(\d+):\s+([^\[]+?)(?:\s+\[(selected)\])?$/);
    if (!match) {
      return null;
    }
    const [, index, url, selected] = match;
    return {
      index: Number.parseInt(index, 10),
      url: url.trim(),
      selected: selected === 'selected'
    };
  }).filter(Boolean);
}

async function withMcpClient(browserUrl, fn) {
  await ensureChromeDevtoolsPatch();
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['chrome-devtools-mcp', '--browserUrl', browserUrl],
    env: process.env,
    cwd: process.cwd(),
    stderr: 'pipe'
  });
  const client = new Client({ name: 'mini-translate-capture', version: '1.0.0' });
  try {
    await client.connect(transport);
    return await fn(client);
  } finally {
    await client.close();
  }
}

async function callTool(client, name, args = {}, opts = {}) {
  const res = await client.callTool({ name, arguments: args });
  if (res.isError) {
    const detail = res.content?.map((c) => c.text).filter(Boolean).join('\n');
    throw new Error(`Tool ${name} failed${detail ? `: ${detail}` : ''}`);
  }
  if (opts.includeText) {
    const textBlock = res.content?.find((c) => c.type === 'text');
    return textBlock?.text ?? '';
  }
  return res;
}

async function ensurePageSelected(client, browserUrl, targetUrl) {
  const listRes = await callTool(client, 'list_pages');
  const text = listRes.content?.find((c) => c.type === 'text')?.text ?? '';
  const pages = parsePagesText(text);
  const target = pages.find((page) => page.url === targetUrl);
  if (target) {
    if (!target.selected) {
      await callTool(client, 'select_page', { pageIdx: target.index });
    }
    return target.index;
  }
  const firstInspectable = pages[0]?.index ?? 0;
  await callTool(client, 'select_page', { pageIdx: firstInspectable });
  try {
    await callTool(client, 'new_page', { url: targetUrl });
  } catch (error) {
    if (/ERR_BLOCKED_BY_CLIENT/.test(error.message)) {
      const createUrl = `${browserUrl}/json/new?${encodeURIComponent(targetUrl)}`;
      const res = await fetch(createUrl, { method: 'PUT' });
      if (!res.ok) {
        throw new Error(`Failed to create target via DevTools endpoint ${createUrl}: ${res.status} ${res.statusText}`);
      }
      await delay(500);
    } else {
      throw error;
    }
  }
  const retryRes = await callTool(client, 'list_pages');
  const retryText = retryRes.content?.find((c) => c.type === 'text')?.text ?? '';
  const retryPages = parsePagesText(retryText);
  const created = retryPages.find((page) => page.url === targetUrl);
  if (!created) {
    throw new Error(`Unable to open page ${targetUrl}; available pages: ${retryPages.map((p) => p.url).join(', ')}`);
  }
  return created.index;
}

function parseSnapshot(text) {
  const nodes = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(/uid=([^\s]+)\s+(\S+)\s+"([^"]*)"(.*)$/);
    if (!match) continue;
    const [, uid, role, name, rest] = match;
    const attrs = {};
    const attrRegex = /(\w+)=\"([^\"]*)\"/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(rest)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }
    nodes.push({ uid, role, name, attrs, line });
  }
  return nodes;
}

function matchNode(nodes, target) {
  const { role, name, attributes } = target;
  const candidates = nodes.filter((node) => {
    const roleOk = role ? node.role.toLowerCase() === role.toLowerCase() : true;
    const nameOk = name ? node.name.trim() === name.trim() : true;
    if (!roleOk || !nameOk) return false;
    if (attributes) {
      return Object.entries(attributes).every(([key, value]) => node.attrs[key] === value);
    }
    return true;
  });
  if (candidates.length === 0) {
    const preview = nodes.slice(0, 30).map((node) => node.line).join('\n');
    throw new Error(`Unable to resolve UID for target ${target.key}. Snapshot preview:\n${preview}`);
  }
  if (candidates.length > 1) {
    const lines = candidates.map((node) => node.line).join('\n');
    throw new Error(`Multiple matches for ${target.key}. Candidates:\n${lines}`);
  }
  return candidates[0];
}

async function captureTargets({ browserUrl, configPath, outputPath, extId, verifyOnly }) {
  const configRaw = await fs.readFile(configPath, 'utf8');
  const config = JSON.parse(configRaw);
  const pages = {};

  await ensureInspectablePage(browserUrl);
  const extensionId = await discoverExtensionId(browserUrl, extId);

  await withMcpClient(browserUrl, async (client) => {
    for (const pageConfig of config.pages) {
      const pageUrl = pageConfig.urlTemplate.replace('{EXTENSION_ID}', extensionId);
      const waitFor = pageConfig.waitFor;
      const pageIdx = await ensurePageSelected(client, browserUrl, pageUrl);
      if (waitFor) {
        await callTool(client, 'wait_for', { text: waitFor });
      } else {
        await delay(250);
      }
      const snapshotRes = await callTool(client, 'take_snapshot');
      const snapshotText = snapshotRes.content?.find((c) => c.type === 'text')?.text ?? '';
      const nodes = parseSnapshot(snapshotText);
      const uidMap = {};
      for (const target of pageConfig.targets) {
        const node = matchNode(nodes, target);
        uidMap[target.key] = {
          uid: node.uid,
          role: node.role,
          name: node.name
        };
      }
      pages[pageConfig.id] = {
        url: pageUrl,
        waitFor,
        pageIndex: pageIdx,
        snapshot: {
          nodeCount: nodes.length
        },
        uids: uidMap
      };
    }
  });

  const result = {
    extensionId,
    browserUrl,
    capturedAt: new Date().toISOString(),
    pages
  };

  if (verifyOnly) {
    console.log('[capture-uids] Verification succeeded. UID map not written (--verify-only).');
    return result;
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`[capture-uids] UID map written to ${outputPath}`);
  return result;
}

async function maybeApplyBatches(uidResult) {
  const scriptPath = path.resolve(__dirname, 'apply-uids.mjs');
  try {
    await fs.access(scriptPath);
  } catch {
    console.warn('[capture-uids] apply-uids.mjs not found; skipping batch update.');
    return;
  }
  const { spawn } = await import('node:child_process');
  await new Promise((resolve, reject) => {
    const proc = spawn('node', [scriptPath], {
      stdio: 'inherit',
      env: {
        ...process.env,
        MCP_UID_SOURCE: JSON.stringify(uidResult)
      }
    });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`apply-uids exited with code ${code}`));
    });
  });
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  if (argv.help) {
    printHelp();
    process.exit(0);
  }
  const browserUrl = normalizeBrowserUrl(argv.browserUrl ?? DEFAULT_BROWSER_URL);
  const configPath = path.resolve(argv.configPath ?? DEFAULT_CONFIG);
  const outputPath = path.resolve(argv.outputPath ?? DEFAULT_OUTPUT);
  const verifyOnly = Boolean(argv.verifyOnly);
  if (!argv.update && !verifyOnly) {
    try {
      await fs.access(outputPath);
      console.warn(`[capture-uids] ${outputPath} already exists. Use --update to overwrite or --verify-only.`);
      process.exit(1);
    } catch {
      // ok
    }
  }

  try {
    const uidResult = await captureTargets({
      browserUrl,
      configPath,
      outputPath,
      extId: argv.extId,
      verifyOnly
    });
    if (argv.writeBatches) {
      await maybeApplyBatches(uidResult);
    }
  } catch (error) {
    console.error('[capture-uids] Failed:', error.message);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
