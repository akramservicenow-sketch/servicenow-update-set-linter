'use strict';

const { findGlideVariables, escapeRegex } = require('../script-utils');

module.exports = {
  id: 'SN008',
  name: 'missing-set-limit',
  description: 'Single-row lookup (query() then if (gr.next())) without setLimit(1).',
  defaultSeverity: 'warning',
  tags: ['performance'],
  tables: ['sys_script', 'sys_script_include', 'sys_ui_action'],
  check({ script }) {
    const text = script.noStrings;
    const findings = [];
    for (const v of findGlideVariables(text, script.code)) {
      if (v.className === 'GlideAggregate') continue;
      const n = escapeRegex(v.name);
      const queries = new RegExp(`\\b${n}\\s*\\.\\s*query\\s*\\(`).test(text);
      const singleRow = new RegExp(`\\bif\\s*\\(\\s*!?\\s*${n}\\s*\\.\\s*next\\s*\\(\\s*\\)\\s*\\)`).test(text);
      const iterates = new RegExp(`\\bwhile\\s*\\(\\s*${n}\\s*\\.\\s*next\\s*\\(`).test(text);
      const limited = new RegExp(`\\b${n}\\s*\\.\\s*setLimit\\s*\\(`).test(text);
      if (queries && singleRow && !iterates && !limited) {
        findings.push({
          index: v.index,
          message: `'${v.name}' is used for a single-row lookup but has no setLimit(1); the database may still read every matching row.`,
        });
      }
    }
    return findings;
  },
};
