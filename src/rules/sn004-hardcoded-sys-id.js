'use strict';

const { matchAll } = require('../script-utils');

module.exports = {
  id: 'SN004',
  name: 'hardcoded-sys-id',
  description: 'Hard-coded 32-character sys_id literals break when reference data differs between instances.',
  defaultSeverity: 'warning',
  tags: ['maintainability', 'upgrade-risk', 'portability'],
  tables: ['sys_script', 'sys_script_client', 'sys_script_include', 'sys_ui_action'],
  /** options.allow: sys_ids that are intentionally referenced (e.g. platform constants). */
  check({ script, options }) {
    const allow = new Set((options.allow || []).map((s) => String(s).toLowerCase()));
    return matchAll(/(['"])([0-9a-f]{32})\1/i, script.noComments)
      .filter(({ match }) => !allow.has(match[2].toLowerCase()))
      .map(({ index, match }) => ({
        index,
        message: `Hard-coded sys_id '${match[2]}'. Store it in a system property or look the record up by a stable key so the code survives clones and environment differences.`,
      }));
  },
};
