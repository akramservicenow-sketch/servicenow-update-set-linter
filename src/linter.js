'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { rules } = require('./rules');
const { extractRecords } = require('./extract');
const { maskScript, positionMapper, parseSuppressions } = require('./script-utils');
const { resolveConfig, severityRank } = require('./config');

const SEVERITY_ORDER = { error: 0, warning: 1, note: 2 };

function isIgnored(record, config) {
  return config.ignoreRecords.some((re) => re.test(record.name));
}

/**
 * Run all enabled rules against one extracted record.
 * @returns {object[]} findings
 */
function lintRecord(record, config = resolveConfig()) {
  if (isIgnored(record, config)) return [];
  const findings = [];

  // Records without a script still get record-level rules (e.g. SN012).
  const scripts = record.scripts.length ? record.scripts : [{ field: 'script', code: '', line: record.line }];

  for (const s of scripts) {
    const { noComments, noStrings } = maskScript(s.code);
    const script = { ...s, noComments, noStrings };
    const toPos = positionMapper(s.code);
    const suppressions = parseSuppressions(s.code);
    const lines = s.code.split('\n');

    for (const rule of rules) {
      const settings = config.rules[rule.id];
      if (!settings.enabled || !rule.tables.includes(record.table)) continue;
      if (!rule.recordLevel && !s.code.trim()) continue;
      if (rule.recordLevel && s !== scripts[0]) continue;

      for (const raw of rule.check({ record, script, options: settings.options })) {
        const pos = raw.index !== undefined ? toPos(raw.index) : { line: raw.line || 1, column: 1 };
        const suppressed = suppressions.get(pos.line);
        if (suppressed === '*' || (suppressed && suppressed.has(rule.id))) continue;
        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: settings.severity,
          message: raw.message,
          file: record.file,
          record: { table: record.table, type: record.type, name: record.name, sysId: record.sysId, scope: record.scope },
          field: s.field,
          line: pos.line,
          column: pos.column,
          fileLine: s.line + pos.line - 1,
          snippet: (lines[pos.line - 1] || '').trim().slice(0, 200),
        });
      }
    }
  }
  return findings;
}

function sortFindings(findings) {
  return findings.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.fileLine - b.fileLine ||
      a.column - b.column ||
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.ruleId.localeCompare(b.ruleId)
  );
}

/** Lint XML text (one update set or unload file). */
function lintText(xmlText, file = '<input>', config = resolveConfig()) {
  const { records, updateSet } = extractRecords(xmlText, file);
  const findings = [];
  for (const record of records) findings.push(...lintRecord(record, config));
  return { file, updateSet, recordCount: records.length, findings: sortFindings(findings), error: null };
}

/** Expand files and directories (recursively, *.xml) into a sorted list of files. */
function expandPaths(inputs) {
  const files = [];
  const walk = (p) => {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(p).sort()) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const full = path.join(p, entry);
        if (fs.statSync(full).isDirectory() || entry.toLowerCase().endsWith('.xml')) walk(full);
      }
    } else {
      files.push(p);
    }
  };
  for (const input of inputs) walk(input);
  return files;
}

/**
 * Lint files/directories. Parse errors are captured per file instead of aborting the run.
 */
function lintPaths(inputs, config = resolveConfig()) {
  const results = [];
  for (const file of expandPaths(inputs)) {
    const display = path.relative(process.cwd(), file).split(path.sep).join('/') || file;
    try {
      results.push(lintText(fs.readFileSync(file, 'utf8'), display, config));
    } catch (err) {
      results.push({ file: display, updateSet: null, recordCount: 0, findings: [], error: err.message });
    }
  }
  return results;
}

function summarize(results) {
  const summary = { files: results.length, records: 0, error: 0, warning: 0, note: 0, total: 0, parseErrors: 0 };
  for (const r of results) {
    summary.records += r.recordCount;
    if (r.error) summary.parseErrors++;
    for (const f of r.findings) {
      summary[f.severity]++;
      summary.total++;
    }
  }
  return summary;
}

/** Exit code for CI: 0 clean, 1 findings at/above threshold, 2 parse/usage errors. */
function exitCodeFor(results, failOn) {
  if (results.some((r) => r.error)) return 2;
  if (failOn === 'none') return 0;
  const threshold = severityRank(failOn);
  const failing = results.some((r) => r.findings.some((f) => severityRank(f.severity) >= threshold));
  return failing ? 1 : 0;
}

module.exports = { lintRecord, lintText, lintPaths, expandPaths, summarize, exitCodeFor };
