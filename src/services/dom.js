export function escapeRegExp(str){
  return str.replace(/[.*+?^${}()|[\]\]/g, '\$&');
}

export function buildWordRegex(term){
  const esc = escapeRegExp(term);
  return new RegExp(`\b${esc}\b`, 'gi');
}

export function replaceWithMark(text, term, translation){
  const re = buildWordRegex(term);
  return text.replace(re, (m) => `${m}(${translation || 'T'})`);
}
