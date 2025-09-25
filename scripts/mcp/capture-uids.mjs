#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
let extId = '';
let outputPath = '';
let port = '9222';

for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--ext-id') {
    extId = argv[++i];
  } else if (argv[i] === '--output') {
    outputPath = argv[++i];
  } else if (argv[i] === '--port') {
    port = argv[++i];
  }
}

if (!extId) {
  console.error('[capture-uids] Missing --ext-id');
  process.exit(1);
}

if (!outputPath) {
  outputPath = path.join(process.cwd(), 'tests/mcp/batches/uids.json');
}

const MCP_URL = `http://127.0.0.1:${port}`;

async function runMcpCommand(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['chrome-devtools-mcp@latest', '--browserUrl', MCP_URL, ...args], {
      stdio: 'inherit',
      env: process.env,
    });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed: ${args.join(' ')}`));
    });
  });
}

async function main() {
  console.log(`[capture-uids] Target extension: ${extId}`);
  console.log(`[capture-uids] Output path: ${outputPath}`);

  // TODO: 实际实现需使用 MCP SDK，当前仅写入模板提示
  const placeholder = {
    extensionId: extId,
    uids: {
      options: {
        model: '@uid:model-placeholder',
        importJson: '@uid:import-json-placeholder',
      },
      popup: {
        toggle: '@uid:popup-toggle-placeholder'
      },
      contextMenu: {
        add: '@uid:add-menu-placeholder',
        remove: '@uid:remove-menu-placeholder',
        toggle: '@uid:toggle-menu-placeholder'
      }
    }
  };

  await fs.writeFile(outputPath, JSON.stringify(placeholder, null, 2), 'utf8');
  console.log(`[capture-uids] Placeholder UID file written to ${outputPath}`);
  console.log('[capture-uids] TODO: Replace placeholders by implementing MCP snapshot parsing.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
