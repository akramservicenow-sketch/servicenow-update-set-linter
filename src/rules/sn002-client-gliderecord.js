'use strict';

const { findingsFor, isPureClientScript } = require('./helpers');

module.exports = {
  id: 'SN002',
  name: 'client-gliderecord',
  description: 'GlideRecord used in client-side code (synchronous round trip, returns every field, unsupported in Service Portal).',
  defaultSeverity: 'error',
  tags: ['performance', 'client', 'upgrade-risk'],
  tables: ['sys_script_client', 'sys_ui_action'],
  check({ record, script }) {
    if (!isPureClientScript(record, script)) return [];
    return findingsFor(
      /\bnew\s+GlideRecord\s*\(/,
      script.noStrings,
      'Client-side GlideRecord performs a synchronous server call and exposes full records to the browser. Use GlideAjax with a client-callable Script Include.'
    );
  },
};
