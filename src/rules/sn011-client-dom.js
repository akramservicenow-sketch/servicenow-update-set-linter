'use strict';

const { findingsFor, isPureClientScript } = require('./helpers');

const PATTERNS = [
  /\bdocument\s*\.\s*(getElementById|getElementsBy\w+|querySelector(?:All)?|createElement|write)\s*\(/,
  /\bgel\s*\(/,
  /(^|[^\w$.])\$j?\s*\(/,
  /\bjQuery\s*\(/,
  /\.\s*innerHTML\b/,
];

module.exports = {
  id: 'SN011',
  name: 'client-dom-manipulation',
  description: 'Direct DOM access in client scripts (document.*, gel(), $(), jQuery, innerHTML).',
  defaultSeverity: 'warning',
  tags: ['upgrade-risk', 'client'],
  tables: ['sys_script_client', 'sys_ui_action'],
  check({ record, script }) {
    if (!isPureClientScript(record, script)) return [];
    const text = script.noStrings;
    const message =
      'Direct DOM manipulation depends on undocumented form markup that changes between releases and does not work in Service Portal / Next Experience. Use g_form APIs.';
    const findings = [];
    for (const re of PATTERNS) {
      for (const f of findingsFor(re, text, message)) {
        // Skip a leading non-identifier character captured by the $ pattern.
        const index = /[\w$.]/.test(text[f.index]) ? f.index : f.index + 1;
        findings.push({ ...f, index });
      }
    }
    return findings.sort((a, b) => a.index - b.index);
  },
};
