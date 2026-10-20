'use strict';

const { findingsFor } = require('./helpers');

module.exports = {
  id: 'SN010',
  name: 'no-eval',
  description: 'eval(), new Function() and GlideEvaluator execute dynamic code (injection risk, hard to review).',
  defaultSeverity: 'error',
  tags: ['security'],
  tables: ['sys_script', 'sys_script_client', 'sys_script_include', 'sys_ui_action'],
  check({ script }) {
    const text = script.noStrings;
    return [
      ...findingsFor(/(^|[^.\w$])eval\s*\(/, text, 'eval() executes arbitrary code. Replace with explicit logic or a lookup table.').map(
        (f) => ({ ...f, index: f.index + (text[f.index] === 'e' ? 0 : 1) })
      ),
      ...findingsFor(/\bnew\s+Function\s*\(/, text, 'new Function() compiles code at runtime (equivalent to eval()).'),
      ...findingsFor(
        /\bGlideEvaluator\s*\./,
        text,
        'GlideEvaluator runs dynamic script. Make sure the evaluated string can never contain user-controlled input.'
      ),
    ];
  },
};
