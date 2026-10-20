'use strict';

const { summarize } = require('../linter');
const pkg = require('../../package.json');

/** Machine-readable JSON report. */
function formatJson(results) {
  return (
    JSON.stringify(
      {
        tool: { name: pkg.name, version: pkg.version },
        summary: summarize(results),
        results,
      },
      null,
      2
    ) + '\n'
  );
}

module.exports = { formatJson };
