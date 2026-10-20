'use strict';

const { lintRecord } = require('../src/linter');
const { resolveConfig } = require('../src/config');
const { SUPPORTED_TABLES } = require('../src/extract');

/** Build an in-memory record equivalent to what extract.js produces. */
function makeRecord({ table = 'sys_script', fields = {}, script = '', scope = 'global', name = 'Test record' } = {}) {
  return {
    table,
    type: SUPPORTED_TABLES[table],
    sysId: 'c0ffee00000000000000000000000fff',
    name,
    action: 'INSERT_OR_UPDATE',
    scope,
    isScoped: scope !== 'global',
    fields: { name, ...fields },
    scripts: script ? [{ field: 'script', code: script, line: 1 }] : [],
    file: 'test.xml',
    line: 1,
  };
}

/** Lint a record and return its findings. */
function lint(recordSpec, userConfig = {}) {
  return lintRecord(makeRecord(recordSpec), resolveConfig(userConfig));
}

/** Rule ids reported for a record. */
function ruleIds(recordSpec, userConfig) {
  return lint(recordSpec, userConfig).map((f) => f.ruleId);
}

/** Minimal update set XML wrapping one record in a sys_update_xml payload. */
function updateSetXml(table, fieldsXml, { cdata = true, action = 'INSERT_OR_UPDATE' } = {}) {
  const inner = `<?xml version="1.0" encoding="UTF-8"?><record_update table="${table}"><${table} action="${action}">${fieldsXml}</${table}></record_update>`;
  const payload = cdata ? `<![CDATA[${inner}]]>` : inner.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<unload unload_date="2026-01-01 00:00:00">
<sys_remote_update_set action="INSERT_OR_UPDATE"><name>Unit test set</name></sys_remote_update_set>
<sys_update_xml action="INSERT_OR_UPDATE">
<action>${action}</action>
<payload>${payload}</payload>
</sys_update_xml>
</unload>`;
}

module.exports = { makeRecord, lint, ruleIds, updateSetXml };
