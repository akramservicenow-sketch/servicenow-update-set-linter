'use strict';

module.exports = {
  id: 'SN012',
  name: 'global-business-rule',
  description: "Business Rule on the 'global' table is evaluated for every table on every transaction.",
  defaultSeverity: 'warning',
  tags: ['performance', 'upgrade-risk'],
  tables: ['sys_script'],
  recordLevel: true,
  check({ record }) {
    if (String(record.fields.collection || '').trim().toLowerCase() !== 'global') return [];
    return [
      {
        line: 1,
        message:
          "Global Business Rule: its script is loaded for every table and transaction. Move reusable functions into a Script Include and attach rules to specific tables.",
      },
    ];
  },
};
