#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const PROJECT_ROOT = process.cwd();
const DEFAULT_UID_PATH = path.join(PROJECT_ROOT, 'tests/mcp/batches/uids.json');
const BATCH_DIR = path.join(PROJECT_ROOT, 'tests/mcp/batches');
const TEMPLATE_SUFFIX = '.template.json';

function loadUidSource() {
  if (process.env.MCP_UID_SOURCE) {
    return JSON.parse(process.env.MCP_UID_SOURCE);
  }
  return null;
}

async function readUidFile() {
  const raw = await fs.readFile(DEFAULT_UID_PATH, 'utf8');
  return JSON.parse(raw);
}

function buildUidLookup(uidData) {
  const map = new Map();
  for (const [pageId, pageInfo] of Object.entries(uidData.pages ?? {})) {
    for (const [key, info] of Object.entries(pageInfo.uids ?? {})) {
      if (!info?.uid) continue;
      map.set(`${pageId}.${key}`, info.uid);
      // also store short key when unique
      if (!map.has(key)) {
        map.set(key, info.uid);
      }
    }
  }
  return map;
}

function replacePlaceholders(value, { extensionId, uidLookup }) {
  if (typeof value === 'string') {
    if (value.includes('<EXTENSION_ID_PLACEHOLDER>')) {
      return value.replaceAll('<EXTENSION_ID_PLACEHOLDER>', extensionId);
    }
    const uidMatch = value.match(/^@uid:(.+)$/);
    if (uidMatch) {
      const key = uidMatch[1];
      if (!uidLookup.has(key)) {
        throw new Error(`Missing UID for placeholder @uid:${key}`);
      }
      return uidLookup.get(key);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replacePlaceholders(item, { extensionId, uidLookup }));
  }
  if (value && typeof value === 'object') {
    const output = Array.isArray(value) ? [] : {};
    for (const [k, v] of Object.entries(value)) {
      output[k] = replacePlaceholders(v, { extensionId, uidLookup });
    }
    return output;
  }
  return value;
}

async function processTemplate(templatePath, context) {
  const outputPath = templatePath.replace(TEMPLATE_SUFFIX, '.json');
  const raw = await fs.readFile(templatePath, 'utf8');
  const data = JSON.parse(raw);
  const resolved = replacePlaceholders(data, context);
  const outputRaw = JSON.stringify(resolved, null, 2);
  if (outputRaw.includes('@uid:') || outputRaw.includes('<EXTENSION_ID_PLACEHOLDER>')) {
    throw new Error(`Placeholder replacement incomplete for ${path.basename(templatePath)}`);
  }
  await fs.writeFile(outputPath, `${outputRaw}\n`, 'utf8');
  return outputPath;
}

async function main() {
  try {
    const uidData = loadUidSource() ?? await readUidFile();
    const uidLookup = buildUidLookup(uidData);
    const context = {
      extensionId: uidData.extensionId,
      uidLookup
    };
    if (!context.extensionId) {
      throw new Error('UID source missing extensionId');
    }
    const entries = await fs.readdir(BATCH_DIR);
    const templates = entries.filter((name) => name.endsWith(TEMPLATE_SUFFIX));
    if (templates.length === 0) {
      console.log('[apply-uids] No template files found.');
      return;
    }
    const written = [];
    const skipped = [];
    for (const template of templates) {
      const templatePath = path.join(BATCH_DIR, template);
      try {
        const outputPath = await processTemplate(templatePath, context);
        written.push(path.relative(PROJECT_ROOT, outputPath));
      } catch (error) {
        skipped.push({ template, reason: error.message });
        console.warn(`[apply-uids] Skipped ${template}: ${error.message}`);
      }
    }
    if (written.length) {
      console.log(`[apply-uids] Updated batches: ${written.join(', ')}`);
    }
    if (skipped.length) {
      console.log('[apply-uids] Skipped templates:', skipped.map((item) => `${item.template} (${item.reason})`).join('; '));
    }
  } catch (error) {
    console.error('[apply-uids] Failed:', error.message);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
