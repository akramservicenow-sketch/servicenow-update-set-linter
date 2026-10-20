'use strict';

const { findGlideVariables, escapeRegex } = require('../script-utils');

const FILTER_METHODS = [
  'addQuery',
  'addEncodedQuery',
  'addActiveQuery',
  'addInactiveQuery',
  'addNullQuery',
  'addNotNullQuery',
  'addJoinQuery',
  'addDomainQuery',
];

module.exports = {
  id: 'SN009',
  name: 'unfiltered-query',
  description: 'GlideRecord query()/updateMultiple()/deleteMultiple() with no filter (full table scan or table-wide write).',
  defaultSeverity: 'warning',
  tags: ['performance', 'data-integrity'],
  tables: ['sys_script', 'sys_script_include', 'sys_ui_action'],
  check({ script }) {
    const text = script.noStrings;
    const findings = [];
    for (const v of findGlideVariables(text, script.code)) {
      const n = escapeRegex(v.name);
      const filtered = new RegExp(`\\b${n}\\s*\\.\\s*(${FILTER_METHODS.join('|')})\\s*\\(`).test(text);
      if (filtered) continue;
      const bulk = new RegExp(`\\b${n}\\s*\\.\\s*(deleteMultiple|updateMultiple)\\s*\\(`).exec(text);
      const query = new RegExp(`\\b${n}\\s*\\.\\s*query\\s*\\(\\s*\\)`).exec(text);
      const table = v.table ? ` on '${v.table}'` : '';
      if (bulk) {
        findings.push({
          index: bulk.index,
          message: `${v.name}.${bulk[1]}()${table} has no filter and will affect every row in the table.`,
        });
      } else if (query) {
        findings.push({
          index: query.index,
          message: `${v.name}.query()${table} has no addQuery()/addEncodedQuery() filter (full table scan).`,
        });
      }
    }
    return findings;
  },
};
