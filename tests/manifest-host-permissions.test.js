import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

describe('Manifest host_permissions validation', () => {
  const publicManifestPath = join(projectRoot, 'public', 'manifest.json');
  const distManifestPath = join(projectRoot, 'dist', 'manifest.json');

  // Required API endpoints for all 5 AI providers
  const requiredHostPermissions = [
    'https://api.openai.com/*',           // OpenAI
    'https://api.anthropic.com/*',         // Anthropic (Claude)
    'https://generativelanguage.googleapis.com/*', // Google Gemini
    'https://api.deepseek.com/*',          // DeepSeek
    'https://dashscope.aliyuncs.com/*'     // Qwen (通义千问)
  ];

  it('public/manifest.json should have all 5 AI provider host permissions', () => {
    const manifestContent = readFileSync(publicManifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);

    expect(manifest.host_permissions, 'host_permissions should exist').toBeDefined();
    expect(Array.isArray(manifest.host_permissions), 'host_permissions should be an array').toBe(true);

    // Check that all required permissions are present
    for (const permission of requiredHostPermissions) {
      expect(
        manifest.host_permissions,
        `Missing permission: ${permission}`
      ).toContain(permission);
    }

    // Verify exactly 5 permissions (no extras, no duplicates)
    expect(
      manifest.host_permissions.length,
      'Should have exactly 5 host permissions'
    ).toBe(5);
  });

  it('dist/manifest.json should have all 5 AI provider host permissions', () => {
    const manifestContent = readFileSync(distManifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);

    expect(manifest.host_permissions, 'host_permissions should exist').toBeDefined();
    expect(Array.isArray(manifest.host_permissions), 'host_permissions should be an array').toBe(true);

    // Check that all required permissions are present
    for (const permission of requiredHostPermissions) {
      expect(
        manifest.host_permissions,
        `Missing permission: ${permission}`
      ).toContain(permission);
    }

    // Verify exactly 5 permissions (no extras, no duplicates)
    expect(
      manifest.host_permissions.length,
      'Should have exactly 5 host permissions'
    ).toBe(5);
  });

  it('should match permissions documented in AI_API_USAGE.md', () => {
    const publicManifest = JSON.parse(readFileSync(publicManifestPath, 'utf8'));
    const distManifest = JSON.parse(readFileSync(distManifestPath, 'utf8'));

    // Verify public and dist manifests are in sync
    expect(
      publicManifest.host_permissions,
      'public and dist manifests should have identical permissions'
    ).toEqual(distManifest.host_permissions);

    // Verify the order matches the expected order
    expect(publicManifest.host_permissions).toEqual(requiredHostPermissions);
  });

  it('should have permissions matching all providers in model-providers.js', () => {
    const manifest = JSON.parse(readFileSync(publicManifestPath, 'utf8'));
    
    // Import MODEL_PROVIDERS configuration to verify alignment
    const modelProvidersPath = join(projectRoot, 'src', 'config', 'model-providers.js');
    const modelProvidersContent = readFileSync(modelProvidersPath, 'utf8');

    // Check that each provider's baseUrl is covered by host_permissions
    const providerUrls = [
      'https://api.openai.com',
      'https://api.anthropic.com',
      'https://generativelanguage.googleapis.com',
      'https://api.deepseek.com',
      'https://dashscope.aliyuncs.com'
    ];

    for (const url of providerUrls) {
      expect(
        modelProvidersContent,
        `Provider ${url} should be defined in model-providers.js`
      ).toContain(url);

      const permission = `${url}/*`;
      expect(
        manifest.host_permissions,
        `Permission for ${url} should be in host_permissions`
      ).toContain(permission);
    }
  });
});
