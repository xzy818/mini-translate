import { validateTerm, upsert, MAX_VOCAB } from './vocab-core.js';

export function exportToTxt(items) {
  const sorted = (items || []).slice().sort((a, b) => {
    return String(a.createdAt).localeCompare(String(b.createdAt));
  });
  return sorted.map((x) => x.term).join('\n');
}

export function exportToJson(items) {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    items: Array.isArray(items) ? items : []
  };
  return JSON.stringify(payload, null, 2);
}

function normalizeLine(line) {
  return String(line || '').trim();
}

export function importFromTxt(text, existingList) {
  const lines = String(text || '').split(/\r?\n/);
  let list = Array.isArray(existingList) ? existingList.slice() : [];
  const failed = [];
  let inserted = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = normalizeLine(lines[i]);
    if (!raw) continue;

    const check = validateTerm({ term: raw });
    if (!check.ok) {
      failed.push({ line: i + 1, value: raw, reason: 'INVALID_TERM' });
      continue;
    }
    const { list: next, error, inserted: ok, replaced } = upsert(list, check.item);
    if (error === 'LIMIT_EXCEEDED') {
      failed.push({ line: i + 1, value: raw, reason: 'LIMIT_EXCEEDED' });
      continue;
    }
    list = next;
    if (ok) inserted += 1;
    if (replaced) {
      // treat replace as success but not counted in inserted
    }
    if (list.length >= MAX_VOCAB) {
      // stop early if reached cap
      // remaining lines will be reported as over-cap if non-empty
      for (let j = i + 1; j < lines.length; j += 1) {
        const rest = normalizeLine(lines[j]);
        if (rest) failed.push({ line: j + 1, value: rest, reason: 'LIMIT_EXCEEDED' });
      }
      break;
    }
  }
  return { list, inserted, failed };
}

export function importFromJson(jsonText, existingList) {
  let parsed;
  try {
    parsed = JSON.parse(String(jsonText || ''));
  } catch (e) {
    return { list: existingList || [], inserted: 0, failed: [{ line: 0, reason: 'INVALID_JSON' }] };
  }
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  let list = Array.isArray(existingList) ? existingList.slice() : [];
  const failed = [];
  let inserted = 0;

  for (let i = 0; i < items.length; i += 1) {
    const raw = items[i];
    const check = validateTerm(raw);
    if (!check.ok) {
      failed.push({ line: i + 1, value: raw && raw.term, reason: 'INVALID_TERM' });
      continue;
    }
    const { list: next, error, inserted: ok, replaced } = upsert(list, check.item);
    if (error === 'LIMIT_EXCEEDED') {
      failed.push({ line: i + 1, value: check.item.term, reason: 'LIMIT_EXCEEDED' });
      continue;
    }
    list = next;
    if (ok) inserted += 1;
    if (replaced) {
      // ignore
    }
    if (list.length >= MAX_VOCAB) {
      for (let j = i + 1; j < items.length; j += 1) {
        const rest = items[j];
        const term = rest && rest.term ? rest.term : '';
        if (term) failed.push({ line: j + 1, value: term, reason: 'LIMIT_EXCEEDED' });
      }
      break;
    }
  }
  return { list, inserted, failed };
}


