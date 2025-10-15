import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/config/model-providers.js', () => ({
  MODEL_PROVIDERS: {
    openai: { name: 'OpenAI', baseUrl: 'https://api.openai', models: { 'gpt-4o-mini': 'gpt-4o-mini' } },
    qwen: { name: 'Qwen', baseUrl: 'https://api.qwen', models: { 'qwen-mt-plus': 'qwen-mt-plus' } }
  }
}));

let ConfigValidator, configValidator;

beforeEach(async () => {
  vi.resetModules();
  ({ ConfigValidator, configValidator } = await import('../src/services/config-validator.js'));
});

describe('ConfigValidator basic rules', () => {
  it('validateProvider: ok and fail', () => {
    const v = new ConfigValidator();
    expect(v.validateProvider('openai').isValid).toBe(true);
    expect(v.validateProvider('unknown').isValid).toBe(false);
  });

  it('validateModel: ok and fail', () => {
    const v = new ConfigValidator();
    expect(v.validateModel('openai', 'gpt-4o-mini').isValid).toBe(true);
    expect(v.validateModel('openai', 'not-exist').isValid).toBe(false);
  });

  it('validateAPIKey: empty and bad format', () => {
    const v = new ConfigValidator();
    expect(v.validateAPIKey('', 'openai').isValid).toBe(false);
    // openai: sk- + 48 chars；这里给一个明显不匹配的
    expect(v.validateAPIKey('sk-short', 'openai').isValid).toBe(false);
  });
});

describe('ConfigValidator user config & consistency', () => {
  it('validateUserConfig: valid', async () => {
    const cfg = { provider: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-' + 'x'.repeat(48) };
    const res = await configValidator.validateUserConfig(cfg);
    expect(res.isValid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it('validateUserConfig: missing fields', async () => {
    const res = await configValidator.validateUserConfig({});
    expect(res.isValid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it('validateConfigConsistency: model-provider mismatch', () => {
    const issues = configValidator.validateConfigConsistency({ provider: 'qwen', model: 'gpt-4o-mini' });
    expect(issues.isValid).toBe(false);
  });

  it('getProviderInfo / getModelInfo', () => {
    const p = configValidator.getProviderInfo('openai');
    expect(p?.name).toBe('OpenAI');
    const m = configValidator.getModelInfo('openai', 'gpt-4o-mini');
    expect(m?.modelId).toBe('gpt-4o-mini');
  });
});


