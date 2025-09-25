#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ARTIFACT_ROOT = path.join(process.cwd(), 'test-artifacts/mcp');
const BATCH_DIR = path.join(process.cwd(), 'tests/mcp/batches');
const BATCH_FILES = ['smoke.json', 'context-menu.json'];

const PORT = process.env.PORT || '9222';
const MCP_URL = `http://127.0.0.1:${PORT}`;

async function runBatch(batchFile, artifactDir) {
  const batchPath = path.join(BATCH_DIR, batchFile);
  const logFile = path.join(artifactDir, `${batchFile}.log`);

  await fs.mkdir(artifactDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['chrome-devtools-mcp@latest', '--browserUrl', MCP_URL, '--config', batchPath], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const writeStream = (data, streamName) => fs.appendFile(logFile, `[${streamName}] ${data}`, 'utf8');

    proc.stdout.on('data', (chunk) => writeStream(chunk, 'STDOUT'));
    proc.stderr.on('data', (chunk) => writeStream(chunk, 'STDERR'));

    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${batchFile} failed with exit code ${code}`));
    });
  });
}

async function main() {
  if (!(await fs.stat(BATCH_DIR).catch(() => false))) {
    console.error('[run-suite] Batch directory not found, aborting.');
    process.exit(1);
  }

  if (!await fs.stat(ARTIFACT_ROOT).catch(() => false)) {
    await fs.mkdir(ARTIFACT_ROOT, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(ARTIFACT_ROOT, timestamp);
  await fs.mkdir(runDir, { recursive: true });

  console.log(`[run-suite] Saving artifacts to ${runDir}`);

  for (const batch of BATCH_FILES) {
    const artifactDir = path.join(runDir, path.basename(batch, '.json'));
    try {
      console.log(`[run-suite] Executing batch ${batch}`);
      await runBatch(batch, artifactDir);
      console.log(`[run-suite] Batch ${batch} completed.`);
    } catch (err) {
      console.error(`[run-suite] Batch ${batch} failed:`, err.message);
      process.exit(1);
    }
  }

  console.log('[run-suite] All batches executed. Review logs in artifact directory.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
