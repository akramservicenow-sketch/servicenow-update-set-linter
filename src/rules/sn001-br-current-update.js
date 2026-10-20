'use strict';

const { findingsFor } = require('./helpers');

module.exports = {
  id: 'SN001',
  name: 'br-current-update',
  description: 'current.update() inside a before/after Business Rule causes redundant writes and recursion risk.',
  defaultSeverity: 'error',
  tags: ['performance', 'recursion', 'upgrade-risk'],
  tables: ['sys_script'],
  check({ record, script }) {
    const when = String(record.fields.when || '').trim().toLowerCase();
    if (when !== 'before' && when !== 'after') return [];
    const message =
      when === 'before'
        ? 'current.update() in a before Business Rule is redundant (changes to current are saved automatically) and triggers a second database update.'
        : 'current.update() in an after Business Rule re-runs before/after rules on the same record (recursion risk). Move the logic to a before rule.';
    return findingsFor(/\bcurrent\s*\.\s*update\s*\(/, script.noStrings, message);
  },
};
