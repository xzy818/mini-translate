import { describe, it, expect, beforeEach, vi } from 'vitest';

const createChromeStub = () => {
  const bag = { aiLogs: [], aiUsage: [] };
  const errors = { get: null, set: null, remove: null };
  const chromeStub = {
    storage: {
      local: {
        get(keys, cb) {
          const err = errors.get;
          errors.get = null;
          if (err) {
            chromeStub.runtime.lastError = { message: err };
          } else {
            chromeStub.runtime.lastError = null;
          }
          if (Array.isArray(keys)) {
            const out = {};
            keys.forEach((key) => { out[key] = bag[key]; });
            cb(out);
          } else if (typeof keys === 'string') {
            cb({ [keys]: bag[keys] });
          } else if (typeof keys === 'object') {
            const out = { ...keys };
            Object.keys(keys).forEach((key) => {
              if (bag[key] !== undefined) {
                out[key] = bag[key];
              }
            });
            cb(out);
          } else {
            cb({});
          }
        },
        set(values, cb) {
          const err = errors.set;
          errors.set = null;
          if (err) {
            chromeStub.runtime.lastError = { message: err };
            cb?.();
            return;
          }
          Object.assign(bag, values);
          chromeStub.runtime.lastError = null;
          cb?.();
        },
        remove(keys, cb) {
          const err = errors.remove;
          errors.remove = null;
          if (err) {
            chromeStub.runtime.lastError = { message: err };
            cb?.();
            return;
          }
          keys.forEach((key) => delete bag[key]);
          chromeStub.runtime.lastError = null;
          cb?.();
        }
      }
    },
    runtime: {
      lastError: null
    },
    _bag: bag,
    _errors: errors
  };
  return chromeStub;
};

let MonitorService;

beforeEach(async () => {
  vi.resetModules();
  global.chrome = createChromeStub();
  ({ MonitorService } = await import('../src/services/monitor-service.js'));
});

describe('MonitorService basic logging', () => {
  it('logRequest stores request logs and usage', () => {
    MonitorService.logRequest('openai', 'gpt-4o', 120, true, 42);
    const logs = chrome._bag.aiLogs;
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ provider: 'openai', success: true, type: 'request' });
    const usage = chrome._bag.aiUsage;
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ provider: 'openai', tokens: 42, type: 'usage' });
  });

  it('logRequest without success does not track usage', () => {
    MonitorService.logRequest('openai', 'gpt-4o', 80, false, 0);
    expect(chrome._bag.aiLogs).toHaveLength(1);
    expect(chrome._bag.aiUsage).toHaveLength(0);
  });

  it('logError and logInfo append entries', () => {
    MonitorService.logError('openai', 'gpt-4o', new Error('fail'));
    MonitorService.logInfo('ready', { status: 'ok' });
    expect(chrome._bag.aiLogs).toHaveLength(2);
    expect(chrome._bag.aiLogs[0].type).toBe('error');
    expect(chrome._bag.aiLogs[1].type).toBe('info');
  });

  it('trims stored logs to 1000 entries', () => {
    const existing = Array.from({ length: 1000 }, (_, i) => ({ timestamp: i, provider: 'p', model: 'm', type: 'request', success: true, duration: 10 }));
    chrome._bag.aiLogs = existing;
    MonitorService.logRequest('openai', 'gpt', 10, true, 0);
    expect(chrome._bag.aiLogs).toHaveLength(1000);
    expect(chrome._bag.aiLogs[999].provider).toBe('openai');
  });
});

describe('MonitorService metrics and helpers', () => {
  it('calculateMetrics aggregates per provider and timeframe', async () => {
    const now = Date.now();
    chrome._bag.aiLogs = [
      { timestamp: now - 1000, provider: 'openai', model: 'gpt', type: 'request', success: true, duration: 100 },
      { timestamp: now - 2000, provider: 'openai', model: 'gpt', type: 'request', success: false, duration: 80 },
      { timestamp: now - 3000, provider: 'qwen', model: 'mt', type: 'error', success: false }
    ];
    chrome._bag.aiUsage = [
      { timestamp: now - 1000, provider: 'openai', model: 'gpt', tokens: 50, type: 'usage' }
    ];

    const metrics = MonitorService.calculateMetrics(chrome._bag.aiLogs, chrome._bag.aiUsage, 'openai', '24h');
    expect(metrics.provider).toBe('openai');
    expect(metrics.totalRequests).toBe(2);
    expect(metrics.successfulRequests).toBe(1);
    expect(metrics.failedRequests).toBe(1);
    expect(metrics.totalTokens).toBe(50);
    expect(metrics.providerStats.openai.successRate).toBeGreaterThan(0);
  });

  it('getMetrics returns null when storage errors occur', async () => {
    chrome._errors.get = 'storage down';
    const metrics = await MonitorService.getMetrics();
    expect(metrics).toBeNull();
  });

  it('getTimeRangeMs defaults to 24h for unknown key', () => {
    expect(MonitorService.getTimeRangeMs('unknown')).toBe(24 * 60 * 60 * 1000);
  });
});

describe('MonitorService storage APIs', () => {
  it('getLogs resolves stored entries', async () => {
    chrome._bag.aiLogs = [{ type: 'request', timestamp: Date.now() }];
    const logs = await MonitorService.getLogs();
    expect(logs).toHaveLength(1);
  });

  it('getLogs rejects when runtime.lastError set', async () => {
    chrome._errors.get = 'no access';
    await expect(MonitorService.getLogs()).rejects.toMatchObject({ message: 'no access' });
  });

  it('getUsageStats rejects on runtime error', async () => {
    chrome._errors.get = 'usage fail';
    await expect(MonitorService.getUsageStats()).rejects.toMatchObject({ message: 'usage fail' });
  });

  it('clearLogs clears both storages and propagates errors', async () => {
    chrome._bag.aiLogs = [{ type: 'request' }];
    chrome._bag.aiUsage = [{ type: 'usage' }];
    await MonitorService.clearLogs();
    expect(chrome._bag.aiLogs).toBeUndefined();
    expect(chrome._bag.aiUsage).toBeUndefined();

    chrome._bag.aiLogs = [];
    chrome._bag.aiUsage = [];
    chrome._errors.remove = 'remove fail';
    await expect(MonitorService.clearLogs()).rejects.toMatchObject({ message: 'remove fail' });
  });

  it('exportLogs returns combined snapshot', async () => {
    chrome._bag.aiLogs = [{ type: 'info', timestamp: 1 }];
    chrome._bag.aiUsage = [{ type: 'usage', tokens: 10, timestamp: 1 }];
    const snapshot = await MonitorService.exportLogs();
    expect(snapshot.logs).toHaveLength(1);
    expect(snapshot.usage).toHaveLength(1);
    expect(snapshot.version).toBe('1.0');
  });

  it('importLogs writes provided data and bubbles storage errors', async () => {
    await MonitorService.importLogs({
      logs: [{ type: 'info', timestamp: 1 }],
      usage: [{ type: 'usage', timestamp: 1 }]
    });
    expect(chrome._bag.aiLogs).toHaveLength(1);
    expect(chrome._bag.aiUsage).toHaveLength(1);

    chrome._errors.set = 'write fail';
    await expect(MonitorService.importLogs({ logs: [{}] })).rejects.toMatchObject({ message: 'write fail' });
  });

  it('getHealthStatus reports healthy payload', () => {
    const health = MonitorService.getHealthStatus();
    expect(health.service).toBe('MonitorService');
    expect(health.status).toBe('healthy');
  });
});

