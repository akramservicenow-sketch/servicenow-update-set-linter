'use strict';

const { summarize } = require('../linter');

const COLORS = { error: '\x1b[31m', warning: '\x1b[33m', note: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' };

function pad(str, width) {
  str = String(str);
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

function truncate(str, width) {
  return str.length > width ? str.slice(0, width - 3) + '...' : str;
}

/** Human-readable report grouped by file. */
function formatTable(results, { color = false } = {}) {
  const c = (key, s) => (color ? COLORS[key] + s + COLORS.reset : s);
  const out = [];

  for (const r of results) {
    const header = r.updateSet ? `${r.file}  (update set: ${r.updateSet.name})` : r.file;
    out.push(c('bold', header));
    if (r.error) {
      out.push(`  ${c('error', 'PARSE ERROR')}  ${r.error}`);
      out.push('');
      continue;
    }
    if (r.findings.length === 0) {
      out.push(c('dim', `  no problems in ${r.recordCount} record(s)`));
      out.push('');
      continue;
    }
    out.push(c('dim', `  ${pad('LINE', 7)}${pad('SEVERITY', 9)}${pad('RULE', 7)}${pad('RECORD', 44)}MESSAGE`));
    for (const f of r.findings) {
      const record = truncate(`${f.record.type}: ${f.record.name}`, 42);
      out.push(
        `  ${pad(`${f.fileLine}:${f.column}`, 7)}${c(f.severity, pad(f.severity, 9))}${pad(f.ruleId, 7)}${pad(record, 44)}${f.message}`
      );
    }
    out.push('');
  }

  const s = summarize(results);
  const parts = [`${s.error} error(s)`, `${s.warning} warning(s)`, `${s.note} note(s)`];
  let line = `${s.total} problem(s) (${parts.join(', ')}) in ${s.records} record(s) across ${s.files} file(s)`;
  if (s.parseErrors) line += `; ${s.parseErrors} file(s) could not be parsed`;
  out.push(c(s.error || s.parseErrors ? 'error' : s.total ? 'warning' : 'dim', line));
  return out.join('\n') + '\n';
}

module.exports = { formatTable };
