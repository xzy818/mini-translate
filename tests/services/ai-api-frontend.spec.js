import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { AIApiFrontend } from '../../src/services/ai-api-frontend.js';

describe('AIApiFrontend.callAPI', () => {
  let frontend;
  let sendMessage;

  beforeEach(() => {
    frontend = new AIApiFrontend();
    sendMessage = vi.fn();
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage,
        lastError: null
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const params = { provider: 'openai', model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }], apiKey: 'sk', options: {} };

  it('resolves on ok response', async () => {
    sendMessage.mockImplementation((_msg, cb) => {
      setTimeout(() => cb({ ok: true, result: { text: 'ok', usage: { tokens: 1 } } }), 0);
    });
    const res = await frontend.callAPI(params);
    expect(res).toEqual({ text: 'ok', usage: { tokens: 1 } });
  });

  it('rejects on chrome.runtime.lastError', async () => {
    sendMessage.mockImplementation((_msg, cb) => {
      chrome.runtime.lastError = { message: 'down' };
      setTimeout(() => cb(undefined), 0);
    });
    await expect(frontend.callAPI(params)).rejects.toThrow('down');
  });

  it('rejects on falsy response', async () => {
    sendMessage.mockImplementation((_msg, cb) => {
      setTimeout(() => cb(null), 0);
    });
    await expect(frontend.callAPI(params)).rejects.toThrow('response is empty');
  });

  it('rejects on error response', async () => {
    sendMessage.mockImplementation((_msg, cb) => {
      setTimeout(() => cb({ ok: false, error: 'bad' }), 0);
    });
    await expect(frontend.callAPI(params)).rejects.toThrow('bad');
  });

  it('rejects on timeout', async () => {
    vi.useFakeTimers();
    sendMessage.mockImplementation((_msg, _cb) => {
      // never calls back
    });
    const p = frontend.callAPI({ ...params, options: { timeoutMs: 10 } });
    vi.advanceTimersByTime(20);
    await expect(p).rejects.toThrow('timeout');
  });
});

