import { describe, it, expect, beforeEach, vi } from 'vitest';

const baseProviders = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    models: {
      'gpt-4o-mini': 'gpt-4o-mini',
      'gpt-3.5-turbo': 'gpt-3.5-turbo'
    }
  },
  qwen: {
    name: 'Qwen',
    baseUrl: 'https://dashscope.aliyuncs.com',
    models: {
      'qwen-mt-plus': 'qwen-mt-plus'
    }
  }
};

vi.mock('../src/services/monitor-service.js', () => ({
  MonitorService: {
    logInfo: vi.fn(),
    logError: vi.fn()
  }
}));

vi.mock('../src/services/config-validator.js', () => {
  class FakeValidator {
    async validateUserConfig(config) {
      if (!config?.provider) {
        return { isValid: false, errors: ['provider required'] };
      }
      if (config.provider === 'invalid') {
        return { isValid: false, errors: ['invalid provider'] };
      }
      if (!config.apiKey) {
        return { isValid: false, errors: ['missing api key'] };
      }
      return { isValid: true, errors: [] };
    }
  }
  return {
    ConfigValidator: FakeValidator
  };
});

const installModelProviderMock = (factory) => {
  vi.doMock('../src/config/model-providers.js', factory);
};

const createChromeStub = ({
  getValue = {},
  lastError = null
} = {}) => {
  const bag = { ...getValue };
  const chromeStub = {
    storage: {
      local: {
        _bag: bag,
        get: vi.fn((keys, cb) => {
          if (chromeStub.runtime.lastError) {
            const err = chromeStub.runtime.lastError;
            chromeStub.runtime.lastError = null;
            return cb({});
          }
          if (typeof keys === 'string') {
            cb({ [keys]: bag[keys] });
            return;
          }
          if (Array.isArray(keys)) {
            const out = {};
            keys.forEach((key) => {
              out[key] = bag[key];
            });
            cb(out);
            return;
          }
          cb({ ...bag });
        }),
        set: vi.fn((values, cb) => {
          Object.assign(bag, values);
          cb?.();
        }),
        remove: vi.fn((keys, cb) => {
          keys.forEach((key) => delete bag[key]);
          cb?.();
        })
      }
    },
    runtime: {
      lastError
    }
  };
  return chromeStub;
};

let ConfigManager;

beforeEach(async () => {
  vi.resetModules();
  installModelProviderMock(() => ({ MODEL_PROVIDERS: baseProviders }));
  global.chrome = createChromeStub();
  ({ ConfigManager } = await import('../src/services/config-manager.js'));
});

describe('ConfigManager initialize()', () => {
  it('loads providers and user config successfully', async () => {
    global.chrome = createChromeStub({
      getValue: { aiConfig: { provider: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-123' } }
    });
    installModelProviderMock(() => ({ MODEL_PROVIDERS: baseProviders }));
    ({ ConfigManager } = await import('../src/services/config-manager.js'));
    const manager = new ConfigManager();
    await manager.initialize();
    expect(manager.initialized).toBe(true);
    expect(manager.getProviders()).toHaveLength(2);
    expect(manager.getModels('openai')).toContain('gpt-4o-mini');
    expect(manager.getUserConfig()).toEqual({ provider: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-123' });
  });

  it('wraps provider import failure with ConfigLoadError', async () => {
    installModelProviderMock(() => { throw new Error('boom'); });
    ({ ConfigManager } = await import('../src/services/config-manager.js'));
    const manager = new ConfigManager();
    await expect(manager.initialize()).rejects.toThrow('Failed to initialize ConfigManager');
  });

  it('propagates storage get errors as ConfigLoadError', async () => {
    const chromeStub = createChromeStub({});
    chromeStub.storage.local.get.mockImplementation((_keys, cb) => {
      chromeStub.runtime.lastError = { message: 'storage down' };
      cb({});
    });
    global.chrome = chromeStub;
    installModelProviderMock(() => ({ MODEL_PROVIDERS: baseProviders }));
    ({ ConfigManager } = await import('../src/services/config-manager.js'));
    const manager = new ConfigManager();
    await expect(manager.initialize()).rejects.toThrow('Failed to initialize ConfigManager');
  });
});

describe('ConfigManager.updateUserConfig()', () => {
  let manager;

  beforeEach(async () => {
    manager = new ConfigManager();
    await manager.initialize();
  });

  it('persists validated config and timestamps it', async () => {
    const result = await manager.updateUserConfig({ provider: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-abc' });
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o-mini');
    expect(typeof result.timestamp).toBe('number');
    expect(result.version).toBe('1.0');
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ aiConfig: expect.objectContaining({ provider: 'openai' }) }, expect.any(Function));
  });

  it('throws ConfigValidationError when validator rejects payload', async () => {
    await expect(manager.updateUserConfig({ provider: 'invalid', model: 'none', apiKey: 'sk-abc' }))
      .rejects.toThrow('Invalid configuration');
  });

  it('wraps storage errors in ConfigSaveError', async () => {
    global.chrome.storage.local.set.mockImplementationOnce((_values, cb) => {
      global.chrome.runtime.lastError = { message: 'quota exceeded' };
      cb();
    });
    await expect(manager.updateUserConfig({ provider: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-abc' }))
      .rejects.toThrow('Failed to save user config');
  });
});

describe('ConfigManager queries/clear operations', () => {
  let manager;

  beforeEach(async () => {
    manager = new ConfigManager();
    await manager.initialize();
  });

  it('throws ConfigNotInitializedError when accessing providers before init', () => {
    const fresh = new ConfigManager();
    expect(() => fresh.getProviderConfig('openai')).toThrow('ConfigManager not initialized');
  });

  it('throws ProviderNotFoundError for missing provider key', () => {
    expect(() => manager.getProviderConfig('missing')).toThrow('Provider not found');
  });

  it('clears user config and storage', async () => {
    await manager.updateUserConfig({ provider: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-abc' });
    await manager.clearUserConfig();
    expect(manager.getUserConfig()).toBeNull();
    expect(global.chrome.storage.local.remove).toHaveBeenCalledWith(['aiConfig'], expect.any(Function));
  });

  it('getConfigStats reports aggregate state', async () => {
    await manager.updateUserConfig({ provider: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-abc' });
    const stats = manager.getConfigStats();
    expect(stats.providerCount).toBe(2);
    expect(stats.modelCount).toBeGreaterThan(0);
    expect(stats.hasUserConfig).toBe(true);
    expect(stats.initialized).toBe(true);
  });
});

