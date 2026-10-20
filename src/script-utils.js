'use strict';

/**
 * Helpers for pattern-based analysis of ServiceNow JavaScript.
 *
 * The linter intentionally avoids a full JS parser (zero dependencies, tolerant of the
 * ES5/Rhino dialect and of partial snippets). Instead it masks comments and string
 * contents so regexes do not match inside them, while preserving offsets and newlines.
 */

function blank(ch) {
  return ch === '\n' ? '\n' : ' ';
}

/**
 * Returns two masked copies of `code` with identical length/offsets:
 *  - noComments: comments replaced by spaces (strings intact)
 *  - noStrings:  comments AND string/template literal contents replaced by spaces
 * Regex literals are not detected (documented limitation).
 */
function maskScript(code) {
  let noComments = '';
  let noStrings = '';
  let state = 'code';
  let quote = '';

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1];

    if (state === 'code') {
      if (ch === '/' && next === '/') {
        state = 'line';
        noComments += '  ';
        noStrings += '  ';
        i++;
      } else if (ch === '/' && next === '*') {
        state = 'block';
        noComments += '  ';
        noStrings += '  ';
        i++;
      } else if (ch === '"' || ch === "'" || ch === '`') {
        state = 'string';
        quote = ch;
        noComments += ch;
        noStrings += ch;
      } else {
        noComments += ch;
        noStrings += ch;
      }
    } else if (state === 'line') {
      if (ch === '\n') state = 'code';
      noComments += blank(ch);
      noStrings += blank(ch);
    } else if (state === 'block') {
      if (ch === '*' && next === '/') {
        state = 'code';
        noComments += '  ';
        noStrings += '  ';
        i++;
      } else {
        noComments += blank(ch);
        noStrings += blank(ch);
      }
    } else {
      // inside a string literal
      if (ch === '\\' && i + 1 < code.length) {
        noComments += ch + code[i + 1];
        noStrings += ' ' + blank(code[i + 1]);
        i++;
      } else if (ch === quote) {
        state = 'code';
        noComments += ch;
        noStrings += ch;
      } else {
        if (ch === '\n' && quote !== '`') state = 'code'; // unterminated string: recover
        noComments += ch;
        noStrings += blank(ch);
      }
    }
  }
  return { noComments, noStrings };
}

/** Build a function mapping a string offset to a 1-based {line, column}. */
function positionMapper(code) {
  const starts = [0];
  for (let i = 0; i < code.length; i++) if (code.charCodeAt(i) === 10) starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: offset - starts[lo] + 1 };
  };
}

/** All matches of a global regex as {index, match}. */
function matchAll(regex, text) {
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  const re = new RegExp(regex.source, flags);
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ index: m.index, match: m });
    if (m[0] === '') re.lastIndex++;
  }
  return out;
}

/** Index of the bracket closing the one at `openIndex`, or -1. */
function findMatching(text, openIndex) {
  const open = text[openIndex];
  const close = { '(': ')', '{': '}', '[': ']' }[open];
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * GlideRecord-style variables declared in a script:
 *   var gr = new GlideRecord('incident');
 * @returns {{name: string, className: string, index: number}[]}
 */
function findGlideVariables(noStrings, original) {
  const re = /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*new\s+(GlideRecord|GlideRecordSecure|GlideAggregate)\s*\(/g;
  return matchAll(re, noStrings).map(({ index, match }) => ({
    name: match[1],
    className: match[2],
    index,
    table: extractFirstStringArg(original, index + match[0].length),
  }));
}

function extractFirstStringArg(original, from) {
  const m = /^\s*(['"])([^'"]*)\1/.exec(original.slice(from));
  return m ? m[2] : null;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse inline suppression comments:
 *   // sn-lint-disable-line SN004
 *   // sn-lint-disable-next-line SN007, SN009
 * A directive without rule ids suppresses every rule on that line.
 * @returns {Map<number, Set<string>|'*'>} script line -> suppressed rules
 */
function parseSuppressions(code) {
  const map = new Map();
  const lines = code.split('\n');
  const re = /sn-lint-disable-(next-line|line)\b([^\n*]*)/;
  lines.forEach((text, idx) => {
    const m = re.exec(text);
    if (!m) return;
    const target = m[1] === 'line' ? idx + 1 : idx + 2;
    const ids = (m[2].match(/SN\d{3}/g) || []);
    if (ids.length === 0) map.set(target, '*');
    else {
      const existing = map.get(target);
      if (existing === '*') return;
      const set = existing || new Set();
      ids.forEach((id) => set.add(id));
      map.set(target, set);
    }
  });
  return map;
}

module.exports = {
  maskScript,
  positionMapper,
  matchAll,
  findMatching,
  findGlideVariables,
  escapeRegex,
  parseSuppressions,
};
