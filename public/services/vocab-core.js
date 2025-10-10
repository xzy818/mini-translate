export const MAX_VOCAB = 500;

function canonicalize(term) {
  return typeof term === 'string' ? term.trim().toLowerCase() : '';
}

export function validateTerm(raw) {
  if (!raw || typeof raw.term !== 'string' || !raw.term.trim()) {
    return { ok: false, error: 'INVALID_TERM' };
  }
  const term = raw.term.trim();
  const item = {
    term,
    canonical: canonicalize(term),
    translation: raw.translation || '',
    type: raw.type === 'phrase' ? 'phrase' : 'word',
    length: term.length,
    createdAt: raw.createdAt || new Date().toISOString(),
    lastUsedAt: raw.lastUsedAt || null,
  };
  return { ok: true, item };
}

export function upsert(list, item) {
  const canonical = canonicalize(item.term);
  const idx = list.findIndex((x) => canonicalize(x.term) === canonical);
  if (idx >= 0) {
    const next = list.slice();
    const existing = next[idx];
    next[idx] = {
      ...existing,
      ...item,
      term: existing.term,
      canonical: canonicalize(existing.term)
    };
    return { replaced: true, list: next };
  }
  if (list.length >= MAX_VOCAB) return { error: 'LIMIT_EXCEEDED', list };
  return {
    inserted: true,
    list: [...list, { ...item, canonical }]
  };
}

export function removeByTerm(list, term) {
  const canonical = canonicalize(term);
  const next = list.filter((x) => canonicalize(x.term) !== canonical);
  return { removed: next.length !== list.length, list: next };
}

