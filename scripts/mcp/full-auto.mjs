#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const START_SCRIPT = path.join(PROJECT_ROOT, 'scripts/start-chrome-mcp.sh');
const STOP_SCRIPT = path.join(PROJECT_ROOT, 'scripts/kill-chrome-mcp.sh');
const CAPTURE_SCRIPT = path.join(PROJECT_ROOT, 'scripts/mcp/capture-uids.mjs');
const RUN_SUITE_SCRIPT = path.join(PROJECT_ROOT, 'scripts/mcp/run-suite.mjs');
const BROWSER_URL = process.env.MCP_BROWSER_URL ?? 'http://127.0.0.1:9222';
const SUMMARY_DIR = path.join(PROJECT_ROOT, 'test-artifacts/mcp');

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      env: options.env ?? process.env,
      cwd: PROJECT_ROOT
    });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function waitForChrome(browserUrl, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  const url = `${browserUrl}/json/version`;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) {
        return;
      }
    } catch (error) {
      // ignore until timeout
    }
    await delay(500);
  }
  throw new Error(`Chrome did not become reachable at ${browserUrl} within ${timeoutMs}ms`);
}

async function findLatestSummary() {
  try {
    const entries = await fs.readdir(SUMMARY_DIR, { withFileTypes: true });
    const runs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse();
    for (const dir of runs) {
      const summaryPath = path.join(SUMMARY_DIR, dir, 'summary.json');
      try {
        await fs.access(summaryPath);
        return summaryPath;
      } catch {
        continue;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function main() {
  try {
    console.log('[mcp-auto] Building extension with QA hooks');
    await runCommand('npm', ['run', 'build'], {
      env: {
        ...process.env,
        MT_QA_HOOKS: '1'
      }
    });

    console.log('[mcp-auto] Starting Chrome debug profile');
    await runCommand('bash', [START_SCRIPT]);
    await waitForChrome(BROWSER_URL);

    console.log('[mcp-auto] Capturing UIDs and updating batches');
    await runCommand('node', [CAPTURE_SCRIPT, '--update', '--write-batches']);

    console.log('[mcp-auto] Executing MCP suite');
    await runCommand('node', [RUN_SUITE_SCRIPT]);

    const summaryPath = await findLatestSummary();
    if (summaryPath) {
      console.log(`[mcp-auto] Summary available at ${summaryPath}`);
    } else {
      console.log('[mcp-auto] Suite completed but summary file not found.');
    }
  } catch (error) {
    console.error('[mcp-auto] Failed:', error.message);
    process.exitCode = 1;
  } finally {
    console.log('[mcp-auto] Cleaning up Chrome process');
    try {
      await runCommand('bash', [STOP_SCRIPT]);
    } catch (error) {
      console.warn('[mcp-auto] Cleanup encountered an error:', error.message);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
