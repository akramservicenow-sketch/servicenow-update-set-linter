'use strict';

const { findingsFor } = require('./helpers');

module.exports = {
  id: 'SN013',
  name: 'empty-catch',
  description: 'Empty catch block silently swallows errors.',
  defaultSeverity: 'warning',
  tags: ['reliability', 'maintainability'],
  tables: ['sys_script', 'sys_script_client', 'sys_script_include', 'sys_ui_action'],
  check({ script }) {
    // Comments are masked, so a catch containing only a comment is also reported.
    return findingsFor(
      /\bcatch\s*\(\s*[\w$]*\s*\)\s*\{\s*\}/,
      script.noStrings,
      'Empty catch block hides failures. Log the error (gs.error / console.error) or rethrow it.'
    );
  },
};
