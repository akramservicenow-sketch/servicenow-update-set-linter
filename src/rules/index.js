'use strict';

/** Rule registry, ordered by id. */
const rules = [
  require('./sn001-br-current-update'),
  require('./sn002-client-gliderecord'),
  require('./sn003-client-sync-ajax'),
  require('./sn004-hardcoded-sys-id'),
  require('./sn005-scoped-gs-log'),
  require('./sn006-debug-logging'),
  require('./sn007-nested-query'),
  require('./sn008-missing-set-limit'),
  require('./sn009-unfiltered-query'),
  require('./sn010-eval'),
  require('./sn011-client-dom'),
  require('./sn012-global-business-rule'),
  require('./sn013-empty-catch'),
  require('./sn014-get-row-count'),
];

const byKey = new Map();
for (const rule of rules) {
  byKey.set(rule.id, rule);
  byKey.set(rule.name, rule);
}

function getRule(key) {
  return byKey.get(key);
}

module.exports = { rules, getRule };
