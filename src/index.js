'use strict';

/** Programmatic API. */
const { lintText, lintPaths, lintRecord, summarize, exitCodeFor } = require('./linter');
const { resolveConfig, loadConfig } = require('./config');
const { extractRecords } = require('./extract');
const { rules } = require('./rules');
const { formatTable } = require('./reporters/table');
const { formatJson } = require('./reporters/json');
const { formatSarif } = require('./reporters/sarif');

module.exports = {
  lintText,
  lintPaths,
  lintRecord,
  summarize,
  exitCodeFor,
  resolveConfig,
  loadConfig,
  extractRecords,
  rules,
  formatTable,
  formatJson,
  formatSarif,
};
