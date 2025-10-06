export const MAX_VOCAB = 500;

export function validateTerm(raw) {
  if (!raw || typeof raw.term !== 'string' || !raw.term.trim()) {
    return { ok: false, error: 'INVALID_TERM' };
  }
  const term = raw.term.trim();
  const item = {
    term,
    translation: raw.translation || '',
    type: raw.type === 'phrase' ? 'phrase' : 'word',
    length: term.length,
    createdAt: raw.createdAt || new Date().toISOString(),
    lastUsedAt: raw.lastUsedAt || null,
  };
  return { ok: true, item };
}

export function upsert(list, item) {
  const idx = list.findIndex((x) => x.term === item.term);
  if (idx >= 0) {
    const next = list.slice();
    next[idx] = item;
    return { replaced: true, list: next };
  }
  if (list.length >= MAX_VOCAB) return { error: 'LIMIT_EXCEEDED', list };
  return { inserted: true, list: [...list, item] };
}

export function removeByTerm(list, term) {
  const t = String(term || '').trim();
  const next = list.filter((x) => x.term !== t);
  return { removed: next.length !== list.length, list: next };
}
