export const VOCAB_KEY = 'miniTranslateVocabulary';
export const SETTINGS_KEY = 'settings';
export const MAX_VOCAB = 500;

export function toCanonicalTerm(raw) {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

function normalizeTerm(raw) {
  if (!raw || typeof raw.term !== 'string') return null;
  const term = raw.term.trim();
  if (!term) return null;
  const inferredType = term.split(/\s+/).length > 1 ? 'phrase' : 'word';
  return {
    term,
    canonical: toCanonicalTerm(term),
    translation: typeof raw.translation === 'string' ? raw.translation : '',
    type: raw.type === 'phrase' ? 'phrase' : inferredType,
    length: Number.isFinite(raw.length) ? raw.length : term.length,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || null,
    status: raw.status === 'inactive' || raw.status === 'error' ? raw.status : 'active'
  };
}

function mergeVocabularyEntries(existing, incoming) {
  const nextTranslation = incoming.translation?.trim()
    ? incoming.translation
    : existing.translation;
  const nextStatus = incoming.status === 'active' || existing.status === 'active'
    ? 'active'
    : incoming.status || existing.status;
  const nextType = existing.type === 'phrase' || incoming.type === 'phrase' ? 'phrase' : 'word';
  const nextLength = Math.max(existing.length ?? existing.term.length, incoming.length ?? incoming.term.length);
  return {
    ...existing,
    translation: nextTranslation,
    status: nextStatus,
    type: nextType,
    length: nextLength,
    updatedAt: incoming.updatedAt || existing.updatedAt || null
  };
}

function normalizeVocabularyList(list) {
  const result = [];
  const indexByCanonical = new Map();
  let changed = false;

  list.forEach((raw) => {
    const normalized = normalizeTerm(raw);
    if (!normalized) {
      if (raw) {
        changed = true;
      }
      return;
    }
    const key = normalized.canonical;
    if (indexByCanonical.has(key)) {
      const idx = indexByCanonical.get(key);
      const merged = mergeVocabularyEntries(result[idx], {
        ...normalized,
        term: result[idx].term,
        createdAt: result[idx].createdAt,
        canonical: key
      });
      result[idx] = merged;
      changed = true;
    } else {
      indexByCanonical.set(key, result.length);
      result.push(normalized);
      if (normalized.term !== raw.term || normalized.translation !== raw.translation || normalized.type !== raw.type) {
        changed = true;
      }
    }
  });

  const sorted = [...result].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const reordered = sorted.some((entry, idx) => entry !== result[idx]);
  if (reordered) {
    result.splice(0, result.length, ...sorted);
    changed = true;
  }

  return { list: result, changed };
}

export async function readVocabulary(chromeLike) {
  return new Promise((resolve, reject) => {
    try {
      const area = (chromeLike?.storage && (chromeLike.storage.sync || chromeLike.storage.local)) || null;
      if (!area) {
        resolve([]);
        return;
      }
      area.get({ [VOCAB_KEY]: [] }, (result) => {
        if (chromeLike.runtime?.lastError) {
          reject(new Error(chromeLike.runtime.lastError.message));
          return;
        }
        const rawList = Array.isArray(result[VOCAB_KEY]) ? result[VOCAB_KEY] : [];
        const { list: normalized, changed } = normalizeVocabularyList(rawList);
        if (changed) {
          area.set({ [VOCAB_KEY]: normalized }, () => {
            if (chromeLike.runtime?.lastError) {
              reject(new Error(chromeLike.runtime.lastError.message));
              return;
            }
            resolve(normalized);
          });
          return;
        }
        resolve(normalized);
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function writeVocabulary(chromeLike, list) {
  const normalizedInput = Array.isArray(list) ? list : [];
  const { list: normalized } = normalizeVocabularyList(normalizedInput);
  return new Promise((resolve, reject) => {
    try {
      const area = (chromeLike?.storage && (chromeLike.storage.sync || chromeLike.storage.local)) || null;
      if (!area) {
        resolve();
        return;
      }
      area.set({ [VOCAB_KEY]: normalized }, () => {
        if (chromeLike.runtime?.lastError) {
          reject(new Error(chromeLike.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function appendVocabulary(chromeLike, item) {
  const normalizedItem = normalizeTerm({
    ...item,
    createdAt: item?.createdAt || new Date().toISOString()
  });
  if (!normalizedItem) {
    return { error: 'INVALID_TERM' };
  }
  const current = await readVocabulary(chromeLike);
  const canonical = normalizedItem.canonical;
  const index = current.findIndex((entry) => entry.canonical === canonical);
  if (index >= 0) {
    const base = current[index];
    const merged = mergeVocabularyEntries(base, {
      ...normalizedItem,
      term: base.term,
      createdAt: base.createdAt,
      canonical,
      updatedAt: normalizedItem.updatedAt || new Date().toISOString()
    });
    const next = current.slice();
    next[index] = merged;
    await writeVocabulary(chromeLike, next);
    return { updated: true, list: next };
  }
  if (current.length >= MAX_VOCAB) {
    return { error: 'LIMIT_EXCEEDED', list: current };
  }
  const next = [...current, normalizedItem];
  await writeVocabulary(chromeLike, next);
  return { inserted: true, list: next };
}

export async function removeVocabulary(chromeLike, term) {
  const canonical = toCanonicalTerm(term);
  if (!canonical) {
    return { removed: false, list: await readVocabulary(chromeLike) };
  }
  const current = await readVocabulary(chromeLike);
  const next = current.filter((entry) => entry.canonical !== canonical);
  if (next.length === current.length) {
    return { removed: false, list: current };
  }
  await writeVocabulary(chromeLike, next);
  return { removed: true, list: next };
}

export async function readSettings(chromeLike) {
  return new Promise((resolve, reject) => {
    try {
      const area = (chromeLike?.storage && (chromeLike.storage.sync || chromeLike.storage.local)) || null;
      if (!area) {
        resolve({});
        return;
      }
      area.get({ [SETTINGS_KEY]: {} }, (result) => {
        if (chromeLike.runtime?.lastError) {
          reject(new Error(chromeLike.runtime.lastError.message));
          return;
        }
        resolve(result[SETTINGS_KEY] || {});
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function writeSettings(chromeLike, settings) {
  return new Promise((resolve, reject) => {
    try {
      const area = (chromeLike?.storage && (chromeLike.storage.sync || chromeLike.storage.local)) || null;
      if (!area) {
        resolve();
        return;
      }
      area.set({ [SETTINGS_KEY]: settings }, () => {
        if (chromeLike.runtime?.lastError) {
          reject(new Error(chromeLike.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}
