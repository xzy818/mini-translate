#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { ensureChromeDevtoolsPatch } from './utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ARTIFACT_ROOT = path.join(process.cwd(), 'test-artifacts/mcp');
const BATCH_DIR = path.join(process.cwd(), 'tests/mcp/batches');

const PORT = process.env.PORT || '9222';
const MCP_URL = `http://127.0.0.1:${PORT}`;

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

async function runBatch(batchFile, artifactDir) {
  const batchPath = path.join(BATCH_DIR, batchFile);
  const logFile = path.join(artifactDir, `${batchFile}.log`);

  await fs.mkdir(artifactDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['chrome-devtools-mcp', '--browserUrl', MCP_URL, '--config', batchPath], {
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
  const { dryRun } = parseArgs(process.argv.slice(2));

  if (!(await fs.stat(BATCH_DIR).catch(() => false))) {
    console.error('[run-suite] Batch directory not found, aborting.');
    process.exit(1);
  }

  await ensureChromeDevtoolsPatch();

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
    const batchPath = path.join(BATCH_DIR, batch);
    await validateBatchFile(batchPath);
  }

  if (dryRun) {
    console.log('[run-suite] Dry run complete. All batch files verified.');
    return;
  }

  if (!await fs.stat(ARTIFACT_ROOT).catch(() => false)) {
    await fs.mkdir(ARTIFACT_ROOT, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(ARTIFACT_ROOT, timestamp);
  await fs.mkdir(runDir, { recursive: true });

  console.log(`[run-suite] Saving artifacts to ${runDir}`);

  const summary = [];
  for (const batch of batchFiles) {
    const artifactDir = path.join(runDir, path.basename(batch, '.json'));
    try {
      console.log(`[run-suite] Executing batch ${batch}`);
      await runBatch(batch, artifactDir);
      console.log(`[run-suite] Batch ${batch} completed.`);
      summary.push({
        batch,
        status: 'passed',
        log: path.relative(process.cwd(), path.join(artifactDir, `${batch}.log`))
      });
    } catch (err) {
      console.error(`[run-suite] Batch ${batch} failed:`, err.message);
      summary.push({
        batch,
        status: 'failed',
        error: err.message,
        log: path.relative(process.cwd(), path.join(artifactDir, `${batch}.log`))
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

  const summaryPath = path.join(runDir, 'summary.json');
  await fs.writeFile(summaryPath, JSON.stringify({
    completedAt: new Date().toISOString(),
    result: 'passed',
    batches: summary
  }, null, 2));
  console.log('[run-suite] All batches executed. Review logs in artifact directory.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
