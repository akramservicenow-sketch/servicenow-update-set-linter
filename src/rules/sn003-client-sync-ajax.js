'use strict';

const { findingsFor, isPureClientScript } = require('./helpers');

module.exports = {
  id: 'SN003',
  name: 'client-synchronous-ajax',
  description: 'Synchronous server calls from the browser (GlideAjax.getXMLWait, g_form.getReference without callback).',
  defaultSeverity: 'error',
  tags: ['performance', 'client', 'ux'],
  tables: ['sys_script_client', 'sys_ui_action'],
  check({ record, script }) {
    if (!isPureClientScript(record, script)) return [];
    return [
      ...findingsFor(
        /\.\s*getXMLWait\s*\(/,
        script.noStrings,
        'getXMLWait() blocks the browser until the server responds and is not supported in Service Portal. Use getXMLAnswer()/getXML() with a callback.'
      ),
      ...findingsFor(
        /\bg_form\s*\.\s*getReference\s*\(\s*[^,()]+\)/,
        script.noStrings,
        'g_form.getReference() without a callback is synchronous. Pass a callback function as the second argument.'
      ),
    ];
  },
};
