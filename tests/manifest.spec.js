import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(thisDir, '..');
const publicManifestPath = path.resolve(rootDir, 'public', 'manifest.json');
const distManifestPath = path.resolve(rootDir, 'dist', 'manifest.json');

function readManifest(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

describe('Chrome extension manifest', () => {
  it('registers the background service worker as an ES module in public source', () => {
    const manifest = readManifest(publicManifestPath);
    expect(manifest.background, 'background config missing').toBeDefined();
    expect(manifest.background.type, 'background.type should be module').toBe('module');
  });

  it('registers the background service worker as an ES module in built dist output', () => {
    if (!existsSync(distManifestPath)) {
      // Allow the test to pass in environments where dist/ has not been built yet.
      return;
    }
    const manifest = readManifest(distManifestPath);
    expect(manifest.background, 'background config missing').toBeDefined();
    expect(manifest.background.type, 'background.type should be module').toBe('module');
  });
});
