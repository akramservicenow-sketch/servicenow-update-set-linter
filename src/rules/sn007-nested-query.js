'use strict';

const { matchAll, findMatching } = require('../script-utils');

/** Locate loop bodies as [start, end] offset ranges in comment/string-masked code. */
function loopBodies(text) {
  const ranges = [];
  const bodyAfter = (from) => {
    let k = from;
    while (k < text.length && /\s/.test(text[k])) k++;
    if (text[k] !== '{') return null;
    const end = findMatching(text, k);
    return end === -1 ? null : [k, end];
  };

  for (const { index, match } of matchAll(/\b(while|for)\s*\(/, text)) {
    const open = index + match[0].length - 1;
    const close = findMatching(text, open);
    if (close === -1) continue;
    const body = bodyAfter(close + 1);
    if (body) ranges.push(body);
  }
  for (const { index, match } of matchAll(/\bdo\s*\{/, text)) {
    const open = index + match[0].length - 1;
    const end = findMatching(text, open);
    if (end !== -1) ranges.push([open, end]);
  }
  for (const { index, match } of matchAll(/\.\s*forEach\s*\(\s*function\s*\([^)]*\)\s*\{/, text)) {
    const open = index + match[0].length - 1;
    const end = findMatching(text, open);
    if (end !== -1) ranges.push([open, end]);
  }
  return ranges;
}

module.exports = {
  id: 'SN007',
  name: 'nested-gliderecord-query',
  description: 'GlideRecord/GlideAggregate instantiated inside a loop (N+1 query pattern).',
  defaultSeverity: 'warning',
  tags: ['performance'],
  tables: ['sys_script', 'sys_script_include', 'sys_ui_action'],
  check({ script }) {
    const text = script.noStrings;
    const ranges = loopBodies(text);
    if (ranges.length === 0) return [];
    return matchAll(/\bnew\s+(GlideRecord|GlideRecordSecure|GlideAggregate)\s*\(/, text)
      .filter(({ index }) => ranges.some(([s, e]) => index > s && index < e))
      .map(({ index, match }) => ({
        index,
        message: `new ${match[1]}() inside a loop issues one query per iteration (N+1). Query once with addQuery(field, 'IN', ids) or use GlideAggregate.`,
      }));
  },
};
