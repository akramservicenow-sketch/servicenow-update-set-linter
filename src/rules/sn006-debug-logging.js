'use strict';

const { findingsFor, isClientScript } = require('./helpers');

module.exports = {
  id: 'SN006',
  name: 'leftover-debug-logging',
  description: 'Leftover debug output (console.log, gs.print, unconditional gs.log, jslog, alert).',
  defaultSeverity: 'note',
  tags: ['maintainability', 'performance', 'logging'],
  tables: ['sys_script', 'sys_script_client', 'sys_script_include', 'sys_ui_action'],
  check({ record, script }) {
    const text = script.noStrings;
    const findings = findingsFor(
      /\bconsole\s*\.\s*(log|debug|dir)\s*\(/,
      text,
      (m) => `console.${m[1]}() looks like leftover debug output. Remove it before promoting the update set.`
    );
    if (isClientScript(record)) {
      findings.push(
        ...findingsFor(/\bjslog\s*\(/, text, 'jslog() is debug output; remove it before promotion.'),
        ...findingsFor(/(^|[^.\w$])alert\s*\(/, text, 'alert() blocks the UI. Use g_form.addInfoMessage()/showFieldMsg() instead.')
          .map((f) => ({ ...f, index: f.index + (text[f.index] === 'a' ? 0 : 1) }))
      );
    }
    if (!record.isScoped) {
      // In scoped code these calls are reported by SN005 instead.
      findings.push(
        ...findingsFor(
          /\bgs\s*\.\s*(log|print)\s*\(/,
          text,
          (m) => `gs.${m[1]}() writes unconditionally to the system log. Prefer gs.debug()/gs.info() gated by a property, and remove temporary debug output.`
        )
      );
    }
    return findings;
  },
};
