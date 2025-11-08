import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('public/qa-bridge.js', () => {
  let sendMessage;

  beforeEach(async () => {
    // stub chrome.runtime
    sendMessage = vi.fn();
    vi.stubGlobal('chrome', { runtime: { sendMessage, lastError: null } });
    // fresh import executes IIFE and attaches handlers
    vi.resetModules();
    await import('../../public/qa-bridge.js');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves add/remove/toggle via window message roundtrip', async () => {
    const qa = window.__miniTranslateQA;
    // spy BEFORE issuing calls to capture ids
    const posted = [];
    const origPost = window.postMessage;
    vi.spyOn(window, 'postMessage').mockImplementation((data) => { posted.push(data); });

    const pAdd = qa.add('hello');
    const pRemove = qa.remove('hello');
    const pToggle = qa.toggle();

    await Promise.resolve();
    const ids = posted.map(p => p.qaRequestId);
    expect(ids.length).toBe(3);

    // dispatch success responses
    ids.forEach(id => {
      window.dispatchEvent(new MessageEvent('message', { data: { qaResponse: true, qaRequestId: id, success: true, result: 'ok' }, source: window }));
    });

    await expect(pAdd).resolves.toBe('ok');
    await expect(pRemove).resolves.toBe('ok');
    await expect(pToggle).resolves.toBe('ok');
    window.postMessage = origPost;
  });

  it('rejects on error response and ignores unrelated messages', async () => {
    const qa = window.__miniTranslateQA;
    // capture request id
    let requestId;
    const origPost = window.postMessage;
    vi.spyOn(window, 'postMessage').mockImplementation((data) => { requestId = data.qaRequestId; });
    const p = qa.add('boom');
    await Promise.resolve();
    // unrelated message
    window.dispatchEvent(new MessageEvent('message', { data: { foo: 'bar' }, source: window }));
    // missing id
    window.dispatchEvent(new MessageEvent('message', { data: { qaResponse: true, qaRequestId: 'not-exist', success: true }, source: window }));
    // proper error response
    window.dispatchEvent(new MessageEvent('message', { data: { qaResponse: true, qaRequestId: requestId, success: false, error: 'bad' }, source: window }));
    await expect(p).rejects.toThrow('bad');
    window.postMessage = origPost;
  });

  it('sendQaMessage resolves ok and handles lastError', async () => {
    const qa = window.__miniTranslateQA;
    // ok path
    sendMessage.mockImplementationOnce((_msg, cb) => cb({ ok: true, result: 1 }));
    await expect(qa.applyTerm('t', 'x', 1)).resolves.toEqual({ ok: true, result: 1 });

    // lastError path
    chrome.runtime.lastError = { message: 'fail' };
    sendMessage.mockImplementationOnce((_msg, cb) => cb(undefined));
    await expect(qa.removeTerm('t', 1)).rejects.toThrow('fail');
  });

  it('getCurrentTabId returns tabId or null on error', async () => {
    const qa = window.__miniTranslateQA;
    // ok
    sendMessage.mockImplementationOnce((_msg, cb) => cb({ ok: true, tabId: 123 }));
    await expect(qa.getCurrentTabId()).resolves.toBe(123);
    // error
    chrome.runtime.lastError = { message: 'down' };
    sendMessage.mockImplementationOnce((_msg, cb) => cb(undefined));
    await expect(qa.getCurrentTabId()).resolves.toBe(null);
  });
});


