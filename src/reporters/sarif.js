'use strict';

const crypto = require('node:crypto');
const { rules } = require('../rules');
const pkg = require('../../package.json');

const LEVEL = { error: 'error', warning: 'warning', note: 'note' };
const REPO_URL = 'https://github.com/akramservicenow-sketch/servicenow-update-set-linter';

function fingerprint(f) {
  return crypto
    .createHash('sha256')
    .update([f.ruleId, f.record.table, f.record.sysId || f.record.name, f.field, f.snippet].join('|'))
    .digest('hex');
}

/**
 * SARIF 2.1.0 report suitable for GitHub code scanning (github/codeql-action/upload-sarif).
 * `config` is used to publish the effective severity of each rule.
 */
function formatSarif(results, config) {
  const ruleIndex = new Map(rules.map((r, i) => [r.id, i]));

  const driverRules = rules.map((r) => ({
    id: r.id,
    name: r.name,
    shortDescription: { text: r.description },
    fullDescription: { text: r.description },
    helpUri: `${REPO_URL}#${r.id.toLowerCase()}-${r.name}`,
    defaultConfiguration: {
      level: LEVEL[config && config.rules[r.id] ? config.rules[r.id].severity : r.defaultSeverity],
      enabled: config && config.rules[r.id] ? config.rules[r.id].enabled : true,
    },
    properties: { tags: ['servicenow', ...r.tags] },
  }));

  const sarifResults = [];
  const notifications = [];
  for (const r of results) {
    if (r.error) {
      notifications.push({
        level: 'error',
        message: { text: `Failed to parse ${r.file}: ${r.error}` },
        locations: [{ physicalLocation: { artifactLocation: { uri: r.file, uriBaseId: 'SRCROOT' } } }],
      });
    }
    for (const f of r.findings) {
      const region = { startLine: f.fileLine };
      // Script line 1 shares its file line with the XML start tag, so the column is only exact afterwards.
      if (f.line > 1) region.startColumn = f.column;
      if (f.snippet) region.snippet = { text: f.snippet };
      sarifResults.push({
        ruleId: f.ruleId,
        ruleIndex: ruleIndex.get(f.ruleId),
        level: LEVEL[f.severity],
        message: { text: `${f.message} [${f.record.type} "${f.record.name}", ${f.field} line ${f.line}]` },
        locations: [
          {
            physicalLocation: { artifactLocation: { uri: f.file, uriBaseId: 'SRCROOT' }, region },
            logicalLocations: [
              { name: f.record.name, fullyQualifiedName: `${f.record.table}/${f.record.sysId || f.record.name}`, kind: 'object' },
            ],
          },
        ],
        partialFingerprints: { 'snLintFinding/v1': fingerprint(f) },
      });
    }
  }

  const run = {
    tool: {
      driver: {
        name: 'sn-update-set-lint',
        semanticVersion: pkg.version,
        informationUri: REPO_URL,
        rules: driverRules,
      },
    },
    originalUriBaseIds: { SRCROOT: { uri: './' } },
    results: sarifResults,
  };
  if (notifications.length) {
    run.invocations = [{ executionSuccessful: false, toolExecutionNotifications: notifications }];
  }

  return (
    JSON.stringify(
      {
        $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
        version: '2.1.0',
        runs: [run],
      },
      null,
      2
    ) + '\n'
  );
}

module.exports = { formatSarif };
