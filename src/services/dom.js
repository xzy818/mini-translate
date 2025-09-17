export function escapeRegExp(str){return str.replace(/[.*+?^()|[\]\]/g,'\$&');}
export function buildWordRegex(term){const esc=escapeRegExp(term);return new RegExp(,'gi');}
export function replaceWithMark(text, term, translation){const re=buildWordRegex(term);return text.replace(re, m=>);}
