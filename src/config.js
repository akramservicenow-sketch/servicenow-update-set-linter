'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { rules, getRule } = require('./rules');

const SEVERITIES = ['note', 'warning', 'error'];
const FAIL_ON = ['note', 'warning', 'error', 'none'];
const DEFAULT_CONFIG_FILE = 'sn-lint.config.json';

class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

function severityRank(severity) {
  return SEVERITIES.indexOf(severity);
}

/**
 * Normalise a user config into a resolved config:
 * {
 *   failOn: 'error',
 *   ignoreRecords: [RegExp],
 *   rules: { SN001: { enabled, severity, options } , ... }
 * }
 *
 * Rule entries accept: "off" | "note" | "warning" | "error" | false | true |
 *                      { enabled?, severity?, options? }
 * Rules can be keyed by id (SN004) or name (hardcoded-sys-id).
 */
function resolveConfig(userConfig = {}) {
  if (userConfig === null || typeof userConfig !== 'object' || Array.isArray(userConfig)) {
    throw new ConfigError('Configuration must be a JSON object.');
  }

  const resolved = { failOn: 'error', ignoreRecords: [], rules: {} };
  for (const rule of rules) {
    resolved.rules[rule.id] = { enabled: true, severity: rule.defaultSeverity, options: {} };
  }

  if (userConfig.failOn !== undefined) {
    if (!FAIL_ON.includes(userConfig.failOn)) {
      throw new ConfigError(`Invalid failOn '${userConfig.failOn}'. Expected one of: ${FAIL_ON.join(', ')}.`);
    }
    resolved.failOn = userConfig.failOn;
  }

  if (userConfig.ignoreRecords !== undefined) {
    if (!Array.isArray(userConfig.ignoreRecords)) throw new ConfigError('ignoreRecords must be an array of glob patterns.');
    resolved.ignoreRecords = userConfig.ignoreRecords.map(globToRegex);
  }

  const ruleConfig = userConfig.rules || {};
  if (typeof ruleConfig !== 'object' || Array.isArray(ruleConfig)) throw new ConfigError('rules must be an object.');

  for (const [key, value] of Object.entries(ruleConfig)) {
    const rule = getRule(key);
    if (!rule) throw new ConfigError(`Unknown rule '${key}'. Run with --list-rules to see available rules.`);
    const target = resolved.rules[rule.id];

    if (value === 'off' || value === false) {
      target.enabled = false;
    } else if (value === true) {
      target.enabled = true;
    } else if (typeof value === 'string') {
      assertSeverity(value, key);
      target.enabled = true;
      target.severity = value;
    } else if (value && typeof value === 'object') {
      if (value.enabled !== undefined) target.enabled = Boolean(value.enabled);
      if (value.severity !== undefined) {
        assertSeverity(value.severity, key);
        target.severity = value.severity;
      }
      if (value.options !== undefined) target.options = { ...value.options };
    } else {
      throw new ConfigError(`Invalid setting for rule '${key}'.`);
    }
  }
  return resolved;
}

function assertSeverity(value, key) {
  if (!SEVERITIES.includes(value)) {
    throw new ConfigError(`Invalid severity '${value}' for rule '${key}'. Expected one of: off, ${SEVERITIES.join(', ')}.`);
  }
}

/** Convert a simple glob (only `*` and `?`) into a case-insensitive RegExp. */
function globToRegex(glob) {
  const source = String(glob)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${source}$`, 'i');
}

/**
 * Load a JSON config. With no explicit path, `sn-lint.config.json` in `cwd` is used
 * when present; otherwise defaults apply.
 */
function loadConfig(configPath, cwd = process.cwd()) {
  let file = configPath;
  if (!file) {
    const candidate = path.join(cwd, DEFAULT_CONFIG_FILE);
    if (!fs.existsSync(candidate)) return resolveConfig({});
    file = candidate;
  }
  let raw;
  try {
    raw = fs.readFileSync(path.resolve(cwd, file), 'utf8');
  } catch (err) {
    throw new ConfigError(`Cannot read config file '${file}': ${err.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ConfigError(`Config file '${file}' is not valid JSON: ${err.message}`);
  }
  return resolveConfig(parsed);
}

module.exports = { resolveConfig, loadConfig, severityRank, ConfigError, SEVERITIES, FAIL_ON, DEFAULT_CONFIG_FILE };
