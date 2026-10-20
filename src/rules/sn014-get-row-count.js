'use strict';

const { findingsFor } = require('./helpers');

module.exports = {
  id: 'SN014',
  name: 'getrowcount-for-counting',
  description: 'GlideRecord.getRowCount() loads matching rows just to count them.',
  defaultSeverity: 'note',
  tags: ['performance'],
  tables: ['sys_script', 'sys_script_include', 'sys_ui_action'],
  check({ script }) {
    return findingsFor(
      /\.\s*getRowCount\s*\(\s*\)/,
      script.noStrings,
      "getRowCount() retrieves the result set to count it. Use GlideAggregate with addAggregate('COUNT') instead."
    );
  },
};
