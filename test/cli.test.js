'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('../src/cli');

const ROOT = path.join(__dirname, '..');

function capture(argv, cwd = ROOT) {
  let out = '';
  let err = '';
  const code = run(argv, {
    cwd,
    stdout: { write: (s) => (out += s), isTTY: false },
    stderr: { write: (s) => (err += s) },
  });
  return { code, out, err };
}

test('CLI exits 1 for the risky example and 0 for the clean example', () => {
  assert.equal(capture(['examples/sample-update-set.xml']).code, 1);
  const clean = capture(['examples/clean-update-set.xml']);
  assert.equal(clean.code, 0);
  assert.match(clean.out, /0 problem\(s\)/);
});

test('CLI produces valid SARIF 2.1.0 with rule metadata', () => {
  const { out } = capture(['examples/', '--format', 'sarif', '--fail-on', 'none']);
  const sarif = JSON.parse(out);
  assert.equal(sarif.version, '2.1.0');
  const run0 = sarif.runs[0];
  assert.equal(run0.tool.driver.rules.length, 14);
  assert.ok(run0.results.length > 0);
  for (const r of run0.results) {
    assert.equal(run0.tool.driver.rules[r.ruleIndex].id, r.ruleId);
    assert.ok(r.locations[0].physicalLocation.region.startLine >= 1);
    assert.ok(r.partialFingerprints['snLintFinding/v1']);
  }
});

test('CLI JSON output includes a summary', () => {
  const { out, code } = capture(['examples/sample-update-set.xml', '-f', 'json', '--fail-on', 'none']);
  const report = JSON.parse(out);
  assert.equal(code, 0);
  assert.equal(report.summary.files, 1);
  assert.equal(report.summary.total, report.results[0].findings.length);
});

test('CLI reports parse errors with exit code 2', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snlint-'));
  fs.writeFileSync(path.join(dir, 'broken.xml'), '<unload><sys_script></unload>');
  const { code, out } = capture([dir]);
  assert.equal(code, 2);
  assert.match(out, /PARSE ERROR/);
});

test('CLI validates arguments', () => {
  assert.equal(capture([]).code, 2);
  assert.equal(capture(['examples/', '--format', 'xml']).code, 2);
  assert.equal(capture(['does-not-exist.xml']).code, 2);
  assert.equal(capture(['examples/', '--fail-on', 'always']).code, 2);
});

test('CLI loads a config file and writes to --output', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snlint-'));
  const cfg = path.join(dir, 'cfg.json');
  fs.writeFileSync(cfg, JSON.stringify({ failOn: 'error', rules: { SN001: 'warning', SN002: 'off', SN003: 'off', SN005: 'off', SN010: 'off' } }));
  const outFile = path.join(dir, 'out', 'report.json');
  const { code } = capture(['examples/', '-c', cfg, '-f', 'json', '-o', outFile]);
  assert.equal(code, 0);
  const report = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  assert.equal(report.summary.error, 0);
});

test('CLI lists rules and prints version', () => {
  assert.match(capture(['--list-rules']).out, /SN014/);
  assert.match(capture(['--version']).out, /^\d+\.\d+\.\d+/);
});
