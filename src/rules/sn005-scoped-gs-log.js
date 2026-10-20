'use strict';

const { findingsFor, isServerScript } = require('./helpers');

module.exports = {
  id: 'SN005',
  name: 'scoped-gs-log',
  description: 'gs.log()/gs.print()/gs.logError()/gs.logWarning() are not available to scoped applications.',
  defaultSeverity: 'error',
  tags: ['correctness', 'scoped-app'],
  tables: ['sys_script', 'sys_script_include', 'sys_ui_action'],
  check({ record, script }) {
    if (!record.isScoped || !isServerScript(record)) return [];
    return findingsFor(
      /\bgs\s*\.\s*(log|print|logError|logWarning)\s*\(/,
      script.noStrings,
      (m) => `gs.${m[1]}() is not available in scoped application '${record.scope}'. Use gs.info(), gs.warn(), gs.error() or gs.debug().`
    );
  },
};
