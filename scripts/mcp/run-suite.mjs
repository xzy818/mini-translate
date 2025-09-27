#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ensureChromeDevtoolsPatch } from './utils.mjs';

const PROJECT_ROOT = process.cwd();
const ARTIFACT_ROOT = path.join(PROJECT_ROOT, 'test-artifacts/mcp');
const BATCH_DIR = path.join(PROJECT_ROOT, 'tests/mcp/batches');
const MCP_URL = process.env.MCP_BROWSER_URL ?? 'http://127.0.0.1:9222';
const ARTIFACT_PREFIX = '@artifact/';
const PROJECT_PREFIX = '@project/';

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run')
  };
}

async function validateBatchFile(batchPath) {
  const raw = await fs.readFile(batchPath, 'utf8');
  if (raw.includes('<EXTENSION_ID_PLACEHOLDER>') || raw.includes('@uid:')) {
    throw new Error(`Batch file ${path.basename(batchPath)} still contains placeholders.`);
  }
}

function resolvePlaceholders(value, context) {
  if (typeof value === 'string') {
    if (value.startsWith(ARTIFACT_PREFIX)) {
      const relative = value.slice(ARTIFACT_PREFIX.length);
      const resolved = path.join(context.artifactDir, relative);
      context.pathsToEnsure.add(path.dirname(resolved));
      return resolved;
    }
    if (value.startsWith(PROJECT_PREFIX)) {
      const relative = value.slice(PROJECT_PREFIX.length);
      return path.join(PROJECT_ROOT, relative);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolvePlaceholders(item, context));
  }
  if (value && typeof value === 'object') {
    const output = Array.isArray(value) ? [] : {};
    for (const [key, val] of Object.entries(value)) {
      output[key] = resolvePlaceholders(val, context);
    }
    return output;
  }
  return value;
}

async function loadBatch(batchFile, artifactDir) {
  const batchPath = path.join(BATCH_DIR, batchFile);
  const raw = await fs.readFile(batchPath, 'utf8');
  const json = JSON.parse(raw);
  const context = {
    artifactDir,
    pathsToEnsure: new Set()
  };
  const resolved = resolvePlaceholders(json, context);
  await fs.mkdir(artifactDir, { recursive: true });
  for (const dir of context.pathsToEnsure) {
    if (!dir) continue;
    await fs.mkdir(dir, { recursive: true });
  }
  return resolved;
}

async function createClient() {
  await ensureChromeDevtoolsPatch();
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['chrome-devtools-mcp', '--browserUrl', MCP_URL],
    cwd: PROJECT_ROOT,
    env: process.env,
    stderr: 'pipe'
  });
  const client = new Client({ name: 'mini-translate-runner', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

async function callTool(client, name, params) {
  const res = await client.callTool({ name, arguments: params ?? {} });
  if (res.isError) {
    const detail = res.content?.map((item) => item.text).filter(Boolean).join('\n');
    throw new Error(`Tool ${name} failed${detail ? `: ${detail}` : ''}`);
  }
  return res;
}

function collectText(content) {
  return content
    ?.filter((item) => item.type === 'text' && item.text)
    .map((item) => item.text)
    .join('\n') ?? '';
}

function collectImages(content) {
  return content?.filter((item) => item.type === 'image') ?? [];
}

async function handleAssertions(step, textOutput) {
  if (!step.assert) return;
  if (step.assert.includes && !textOutput.includes(step.assert.includes)) {
    throw new Error(`Assertion failed: output missing "${step.assert.includes}"`);
  }
}

async function saveSnapshot(snapshotPath, textOutput) {
  if (!snapshotPath) return;
  const match = textOutput.match(/## Page content\n([\s\S]+)/);
  const snapshotText = match ? match[1].trim() : textOutput.trim();
  await fs.writeFile(snapshotPath, `${snapshotText}\n`, 'utf8');
}

async function saveScreenshot(imagePath, textOutput, images) {
  if (!imagePath) return;
  await fs.mkdir(path.dirname(imagePath), { recursive: true });
  const image = images[0];
  if (image) {
    const data = Buffer.from(image.data, 'base64');
    await fs.writeFile(imagePath, data);
    return;
  }
  const match = textOutput.match(/Saved screenshot to (.*?)(?:\n|$)/);
  if (!match) {
    throw new Error('Screenshot response did not include image data or saved path.');
  }
  const sourcePath = match[1].trim();
  const data = await fs.readFile(sourcePath);
  await fs.writeFile(imagePath, data);
}

function extractJsonBlock(textOutput) {
  const fenced = textOutput.match(/```json\n([\s\S]*?)\n```/);
  if (fenced) {
    return fenced[1].trim();
  }
  const inline = textOutput.match(/Script ran on page and returned:\n([\s\S]*)/);
  if (inline) {
    return inline[1].trim();
  }
  return textOutput.trim();
}

async function saveScriptResult(savePath, textOutput) {
  if (!savePath) return;
  await fs.mkdir(path.dirname(savePath), { recursive: true });
  const jsonText = extractJsonBlock(textOutput);
  await fs.writeFile(savePath, `${jsonText}\n`, 'utf8');
}

function captureSnapshotId(textOutput, state) {
  const match = textOutput.match(/uid=(\d+)_/);
  if (match) {
    state.snapshotId = match[1];
  }
}

function rewriteUidString(value, snapshotId) {
  if (!snapshotId || typeof value !== 'string') return value;
  const match = value.match(/^(\d+)_([0-9]+)$/);
  if (!match) return value;
  const [, , suffix] = match;
  return `${snapshotId}_${suffix}`;
}

function rewriteUidsInValue(value, snapshotId) {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteUidsInValue(item, snapshotId));
  }
  if (value && typeof value === 'object') {
    const output = Array.isArray(value) ? [] : {};
    for (const [key, val] of Object.entries(value)) {
      output[key] = rewriteUidsInValue(val, snapshotId);
    }
    return output;
  }
  return rewriteUidString(value, snapshotId);
}

function prepareStep(step, snapshotId) {
  const params = step.params ? structuredClone(step.params) : {};
  const artifacts = {};
  if (step.tool === 'take_snapshot' && params.path) {
    artifacts.snapshot = params.path;
    delete params.path;
  }
  if (step.tool === 'take_screenshot' && params.path) {
    artifacts.screenshot = params.path;
    delete params.path;
  }
  if (step.tool === 'evaluate_script' && params.saveAs) {
    artifacts.scriptOutput = params.saveAs;
    delete params.saveAs;
  }
  const normalizedParams = rewriteUidsInValue(params, snapshotId);
  return { params: normalizedParams, artifacts };
}

async function executeStep(client, step, logFile, state) {
  const { params, artifacts } = prepareStep(step, state.snapshotId);
  const res = await callTool(client, step.tool, params);
  const textOutput = collectText(res.content);
  const images = collectImages(res.content);
  captureSnapshotId(textOutput, state);
  await fs.appendFile(logFile, `# Step: ${step.tool}\n\n`, 'utf8');
  if (textOutput) {
    await fs.appendFile(logFile, `${textOutput}\n\n`, 'utf8');
  }
  if (images.length) {
    await fs.appendFile(logFile, `Attached images: ${images.length}\n\n`, 'utf8');
  }
  await handleAssertions(step, textOutput);
  await saveSnapshot(artifacts.snapshot, textOutput);
  await saveScreenshot(artifacts.screenshot, textOutput, images);
  await saveScriptResult(artifacts.scriptOutput, textOutput);
}

async function runBatch(client, batchFile, artifactDir) {
  const batch = await loadBatch(batchFile, artifactDir);
  const logFile = path.join(artifactDir, `${batchFile}.log`);
  await fs.writeFile(logFile, `# Batch ${batch.metadata?.name ?? batchFile}\n\n`, 'utf8');
  const state = { snapshotId: null };
  for (const step of batch.steps ?? []) {
    await executeStep(client, step, logFile, state);
  }
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));

  if (!(await fs.stat(BATCH_DIR).catch(() => false))) {
    console.error('[run-suite] Batch directory not found, aborting.');
    process.exit(1);
  }

  const dirEntries = await fs.readdir(BATCH_DIR, { withFileTypes: true });
  const batchFiles = dirEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && !entry.name.endsWith('.template.json'))
    .map((entry) => entry.name)
    .sort();

  if (batchFiles.length === 0) {
    console.error('[run-suite] No batch JSON files present. Run npm run mcp:capture first.');
    process.exit(1);
  }

  for (const batch of batchFiles) {
    await validateBatchFile(path.join(BATCH_DIR, batch));
  }

  if (dryRun) {
    console.log('[run-suite] Dry run complete. All batch files verified.');
    return;
  }

  await fs.mkdir(ARTIFACT_ROOT, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(ARTIFACT_ROOT, timestamp);
  await fs.mkdir(runDir, { recursive: true });
  console.log(`[run-suite] Saving artifacts to ${runDir}`);

  const client = await createClient();
  const summary = [];
  try {
    for (const batch of batchFiles) {
      const artifactDir = path.join(runDir, path.basename(batch, '.json'));
      try {
        console.log(`[run-suite] Executing batch ${batch}`);
        await runBatch(client, batch, artifactDir);
        console.log(`[run-suite] Batch ${batch} completed.`);
        summary.push({
          batch,
          status: 'passed',
          log: path.relative(PROJECT_ROOT, path.join(artifactDir, `${batch}.log`))
        });
      } catch (error) {
        console.error(`[run-suite] Batch ${batch} failed:`, error.message);
        summary.push({
          batch,
          status: 'failed',
          error: error.message,
          log: path.relative(PROJECT_ROOT, path.join(artifactDir, `${batch}.log`))
        });
        const summaryPath = path.join(runDir, 'summary.json');
        await fs.writeFile(summaryPath, JSON.stringify({
          completedAt: new Date().toISOString(),
          result: 'failed',
          batches: summary
        }, null, 2));
        process.exit(1);
      }
    }
  } finally {
    await client.close();
  }

  const summaryPath = path.join(runDir, 'summary.json');
  await fs.writeFile(summaryPath, JSON.stringify({
    completedAt: new Date().toISOString(),
    result: 'passed',
    batches: summary
  }, null, 2));
  console.log('[run-suite] All batches executed. Review logs in artifact directory.');
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
