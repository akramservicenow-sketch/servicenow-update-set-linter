'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { loadConfig, FAIL_ON, ConfigError } = require('./config');
const { lintPaths, exitCodeFor } = require('./linter');
const { rules } = require('./rules');
const { formatTable } = require('./reporters/table');
const { formatJson } = require('./reporters/json');
const { formatSarif } = require('./reporters/sarif');
const pkg = require('../package.json');

const HELP = `sn-lint ${pkg.version}
Static analysis for exported ServiceNow update sets and unload XML.

Usage:
  sn-lint [options] <file-or-directory...>

Options:
  -f, --format <table|json|sarif>  Output format (default: table)
  -o, --output <file>              Write the report to a file instead of stdout
  -c, --config <file>              Config file (default: ./sn-lint.config.json if present)
      --fail-on <level>            Exit 1 when findings at/above level exist:
                                   note | warning | error | none (default: config or "error")
      --no-color                   Disable ANSI colours in table output
      --list-rules                 Print the rule catalog and exit
  -v, --version                    Print version
  -h, --help                       Show this help

Exit codes:
  0  no findings at or above the fail-on level
  1  findings at or above the fail-on level
  2  usage, configuration or XML parse error
`;

function listRules() {
  const lines = ['ID     SEVERITY  NAME                         DESCRIPTION'];
  for (const r of rules) {
    lines.push(`${r.id.padEnd(7)}${r.defaultSeverity.padEnd(10)}${r.name.padEnd(29)}${r.description}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Run the CLI. Returns the exit code rather than calling process.exit so it is testable.
 * @param {string[]} argv arguments without node/script
 * @param {{stdout?: {write: Function}, stderr?: {write: Function}, cwd?: string}} io
 */
function run(argv, io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const cwd = io.cwd || process.cwd();

  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        format: { type: 'string', short: 'f', default: 'table' },
        output: { type: 'string', short: 'o' },
        config: { type: 'string', short: 'c' },
        'fail-on': { type: 'string' },
        'no-color': { type: 'boolean', default: false },
        'list-rules': { type: 'boolean', default: false },
        version: { type: 'boolean', short: 'v', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (err) {
    stderr.write(`sn-lint: ${err.message}\n\n${HELP}`);
    return 2;
  }
  const { values, positionals } = parsed;

  if (values.help) {
    stdout.write(HELP);
    return 0;
  }
  if (values.version) {
    stdout.write(`${pkg.version}\n`);
    return 0;
  }
  if (values['list-rules']) {
    stdout.write(listRules());
    return 0;
  }
  if (!['table', 'json', 'sarif'].includes(values.format)) {
    stderr.write(`sn-lint: unknown format '${values.format}' (expected table, json or sarif)\n`);
    return 2;
  }
  if (positionals.length === 0) {
    stderr.write(`sn-lint: no input files\n\n${HELP}`);
    return 2;
  }

  let config;
  try {
    config = loadConfig(values.config, cwd);
  } catch (err) {
    stderr.write(`sn-lint: ${err instanceof ConfigError ? err.message : err.stack}\n`);
    return 2;
  }
  const failOn = values['fail-on'] || config.failOn;
  if (!FAIL_ON.includes(failOn)) {
    stderr.write(`sn-lint: invalid --fail-on '${failOn}' (expected ${FAIL_ON.join(', ')})\n`);
    return 2;
  }

  const inputs = positionals.map((p) => path.resolve(cwd, p));
  const missing = inputs.filter((p) => !fs.existsSync(p));
  if (missing.length) {
    stderr.write(`sn-lint: path not found: ${missing.join(', ')}\n`);
    return 2;
  }

  const results = lintPaths(inputs, config);
  let report;
  if (values.format === 'json') report = formatJson(results);
  else if (values.format === 'sarif') report = formatSarif(results, config);
  else {
    const color = !values['no-color'] && !values.output && Boolean(stdout.isTTY) && !process.env.NO_COLOR;
    report = formatTable(results, { color });
  }

  if (values.output) {
    const outFile = path.resolve(cwd, values.output);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, report);
    stderr.write(`sn-lint: report written to ${values.output}\n`);
  } else {
    stdout.write(report);
  }
  return exitCodeFor(results, failOn);
}

module.exports = { run, HELP };
