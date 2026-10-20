'use strict';

const { matchAll } = require('../script-utils');

/**
 * Client-side UI Actions frequently carry a server-side branch guarded by
 *   if (typeof window == 'undefined') serverSideFunction();
 * Code in that branch runs on the server, so client-only rules skip such scripts.
 */
const SERVER_BRANCH_RE = /typeof\s+window\s*[!=]==?\s*['"]undefined['"]/;

function isTrue(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function isClientScript(record) {
  if (record.table === 'sys_script_client') return true;
  return record.table === 'sys_ui_action' && isTrue(record.fields.client);
}

function isServerScript(record) {
  return !isClientScript(record);
}

/** Client script that does not contain a server-side branch. */
function isPureClientScript(record, script) {
  if (!isClientScript(record)) return false;
  return !(record.table === 'sys_ui_action' && SERVER_BRANCH_RE.test(script.code));
}

/** Convert regex matches against a masked copy of the script into raw findings. */
function findingsFor(regex, text, message) {
  return matchAll(regex, text).map(({ index, match }) => ({
    index,
    message: typeof message === 'function' ? message(match) : message,
  }));
}

module.exports = { isTrue, isClientScript, isServerScript, isPureClientScript, findingsFor };
