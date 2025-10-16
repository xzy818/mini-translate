import { describe, it, expect, beforeEach, vi } from 'vitest';

function createChromeMock() {
  const listeners = [];
  const runtime = {
    id: 'test-ext',
    onMessage: {
      addListener: (fn) => listeners.push(fn)
    },
    sendMessage: vi.fn((msg, cb) => { cb && cb({ ok: true }); }),
    getURL: vi.fn((path) => `chrome-extension://test/${path}`)
  };
  return { runtime, _listeners: listeners };
}

describe('content.js basic behaviors', () => {
  beforeEach(() => {
    vi.resetModules();
    // reset DOM
    document.body.innerHTML = '';
    // install chrome mock
    global.chrome = createChromeMock();
  });

  it('APPLY_TRANSLATION updates text nodes via onMessage', async () => {
    const p = import('../public/content.js');
    await p;

    // prepare DOM text
    const div = document.createElement('div');
    div.textContent = 'Agent cooperates.';
    document.body.appendChild(div);

    // trigger APPLY_TRANSLATION
    const applyMsg = { type: 'APPLY_TRANSLATION', payload: { term: 'Agent', translation: '代理' } };
    global.chrome._listeners.forEach((fn) => fn(applyMsg));
    expect(div.textContent).toContain('Agent(代理)');
  });

  it('selection change debounced notify sends SELECTION_CHANGED', async () => {
    const p = import('../public/content.js');
    await p;
    // mock selection
    const selText = 'hello';
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => selText });
    document.dispatchEvent(new Event('selectionchange'));
    // allow debounce 150ms
    await new Promise((r) => setTimeout(r, 160));
    expect(global.chrome.runtime.sendMessage).toHaveBeenCalled();
    const calls = global.chrome.runtime.sendMessage.mock.calls;
    const found = calls.find((c) => c[0]?.type === 'SELECTION_CHANGED');
    expect(found).toBeTruthy();
  });
});


