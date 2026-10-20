'use strict';

const { parseXml, child, textLineOf } = require('./xml');

/** Tables whose scripts are linted, with a human-readable record type. */
const SUPPORTED_TABLES = {
  sys_script: 'Business Rule',
  sys_script_client: 'Client Script',
  sys_script_include: 'Script Include',
  sys_ui_action: 'UI Action',
};

/** Script-bearing fields per table. */
const SCRIPT_FIELDS = {
  sys_script: ['script'],
  sys_script_client: ['script'],
  sys_script_include: ['script'],
  sys_ui_action: ['script'],
};

function isRecordElement(el) {
  return Object.prototype.hasOwnProperty.call(SUPPORTED_TABLES, el.name) && el.children.length > 0;
}

/** Determine scope from the sys_scope field (value or display value). */
function resolveScope(el) {
  const scopeEl = child(el, 'sys_scope');
  if (!scopeEl) return 'global';
  const value = scopeEl.text.trim();
  const display = (scopeEl.attrs.display_value || '').trim();
  if (!value || value === 'global' || display.toLowerCase() === 'global') return 'global';
  return display || value;
}

function buildRecord(el, file) {
  const fields = {};
  for (const c of el.children) fields[c.name] = c.text;

  const scope = resolveScope(el);
  const scripts = [];
  for (const fieldName of SCRIPT_FIELDS[el.name]) {
    const fieldEl = child(el, fieldName);
    if (fieldEl && fieldEl.text.trim()) {
      scripts.push({ field: fieldName, code: fieldEl.text, line: textLineOf(fieldEl) });
    }
  }

  return {
    table: el.name,
    type: SUPPORTED_TABLES[el.name],
    sysId: (fields.sys_id || '').trim(),
    name: (fields.name || fields.sys_name || '(unnamed)').trim(),
    action: el.attrs.action || 'INSERT_OR_UPDATE',
    scope,
    isScoped: scope !== 'global',
    fields,
    scripts,
    file,
    line: el.line,
  };
}

function collectFromDocument(doc, file, out) {
  const visit = (el, insideUpdateXml) => {
    if (el.name === 'sys_update_xml') {
      collectFromUpdateXml(el, file, out);
      return;
    }
    if (!insideUpdateXml && isRecordElement(el)) {
      if (el.attrs.action !== 'DELETE') out.push(buildRecord(el, file));
      return;
    }
    for (const c of el.children) visit(c, insideUpdateXml);
  };
  visit(doc, false);
}

/**
 * A sys_update_xml row stores the customer update as a serialized XML document in
 * its <payload> field (either entity-escaped or wrapped in CDATA). Parse it with a
 * line offset so findings still map to lines in the exported file.
 */
function collectFromUpdateXml(el, file, out) {
  const actionEl = child(el, 'action');
  if (actionEl && actionEl.text.trim() === 'DELETE') return;
  const payloadEl = child(el, 'payload');
  if (!payloadEl || !payloadEl.text.trim()) return;
  const payloadDoc = parseXml(payloadEl.text, { lineOffset: textLineOf(payloadEl) - 1 });
  collectFromDocument(payloadDoc, file, out);
}

/**
 * Extract lintable records from update set / unload XML text.
 * @returns {{records: object[], updateSet: object|null}}
 */
function extractRecords(xmlText, file = '<input>') {
  const doc = parseXml(xmlText);
  const records = [];
  collectFromDocument(doc, file, records);

  let updateSet = null;
  const top = doc.children[0];
  const remote = top && (child(top, 'sys_remote_update_set') || child(top, 'sys_update_set'));
  if (remote) {
    const nameEl = child(remote, 'name');
    updateSet = { name: nameEl ? nameEl.text.trim() : '(unnamed)' };
  }
  return { records, updateSet };
}

module.exports = { extractRecords, SUPPORTED_TABLES };
