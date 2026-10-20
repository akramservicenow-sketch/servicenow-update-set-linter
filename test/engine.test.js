'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { lint, ruleIds, updateSetXml } = require('../test-support/helpers');
const { parseXml, decodeEntities } = require('../src/xml');
const { extractRecords } = require('../src/extract');
const { lintText, exitCodeFor } = require('../src/linter');
const { resolveConfig, ConfigError } = require('../src/config');
const { maskScript } = require('../src/script-utils');

const BR_FIELDS = (script) =>
  `<name>Demo rule</name><collection>incident</collection><when>after</when><sys_id>c0ffee00000000000000000000000001</sys_id>` +
  `<sys_scope display_value="Global">global</sys_scope><script>${script}</script>`;

test('XML parser decodes entities, CDATA and attributes', () => {
  const doc = parseXml('<a x="1 &amp; 2"><b><![CDATA[<raw>]]></b><c>&lt;&#65;&#x42;&gt;</c></a>');
  const a = doc.children[0];
  assert.equal(a.attrs.x, '1 & 2');
  assert.equal(a.children[0].text, '<raw>');
  assert.equal(a.children[1].text, '<AB>');
  assert.equal(decodeEntities('&unknown;'), '&unknown;');
});

test('XML parser rejects DOCTYPE (XXE protection) and malformed documents', () => {
  assert.throws(() => parseXml('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e;</x>'), /DOCTYPE/);
  assert.throws(() => parseXml('<a><b></a>'), /Unexpected closing tag/);
  assert.throws(() => parseXml('<a>'), /Unclosed element/);
});

test('extracts records from CDATA and entity-escaped payloads', () => {
  const script = 'current.update();';
  for (const cdata of [true, false]) {
    const { records, updateSet } = extractRecords(updateSetXml('sys_script', BR_FIELDS(script), { cdata }));
    assert.equal(records.length, 1);
    assert.equal(records[0].type, 'Business Rule');
    assert.equal(records[0].scripts[0].code, script);
    assert.equal(updateSet.name, 'Unit test set');
  }
});

test('skips DELETE updates', () => {
  const { records } = extractRecords(updateSetXml('sys_script', BR_FIELDS('x();'), { action: 'DELETE' }));
  assert.equal(records.length, 0);
});

test('maps script lines to file lines inside nested payloads', () => {
  const xml = updateSetXml('sys_script', BR_FIELDS('var a = 1;\ncurrent.update();'), { cdata: false });
  const { findings } = lintText(xml, 'set.xml');
  const f = findings.find((x) => x.ruleId === 'SN001');
  const fileLines = xml.split('\n');
  assert.match(decodeEntities(fileLines[f.fileLine - 1]), /current\.update\(\)/);
});

test('detects scoped records from sys_scope', () => {
  const fields = '<name>S</name><sys_scope display_value="x_demo_app">c0ffee00000000000000000000000002</sys_scope><script>gs.log(1);</script>';
  const { records } = extractRecords(updateSetXml('sys_script_include', fields));
  assert.equal(records[0].isScoped, true);
  assert.equal(records[0].scope, 'x_demo_app');
});

test('inline suppression comments silence specific rules', () => {
  const script = "// sn-lint-disable-next-line SN004\nvar a = 'c0ffee000000000000000000000000aa';\nvar b = 'c0ffee000000000000000000000000bb'; // sn-lint-disable-line";
  assert.ok(!ruleIds({ table: 'sys_script_include', script }).includes('SN004'));
});

test('suppression for a different rule does not hide the finding', () => {
  const script = "// sn-lint-disable-next-line SN010\nvar a = 'c0ffee000000000000000000000000aa';";
  assert.ok(ruleIds({ table: 'sys_script_include', script }).includes('SN004'));
});

test('config can disable rules and change severity by id or name', () => {
  const spec = { table: 'sys_script_include', script: "var a = 'c0ffee000000000000000000000000aa';\neval(a);" };
  assert.deepEqual(ruleIds(spec, { rules: { SN004: 'off', 'no-eval': 'warning' } }), ['SN010']);
  assert.equal(lint(spec, { rules: { 'no-eval': 'warning' } }).find((f) => f.ruleId === 'SN010').severity, 'warning');
});

test('config validation rejects unknown rules and severities', () => {
  assert.throws(() => resolveConfig({ rules: { SN999: 'error' } }), ConfigError);
  assert.throws(() => resolveConfig({ rules: { SN001: 'critical' } }), /Invalid severity/);
  assert.throws(() => resolveConfig({ failOn: 'sometimes' }), /Invalid failOn/);
  assert.throws(() => resolveConfig([]), ConfigError);
});

test('ignoreRecords skips matching record names', () => {
  const spec = { table: 'sys_script_include', name: 'Vendor_Legacy_Utils', script: 'eval(x);' };
  assert.deepEqual(ruleIds(spec, { ignoreRecords: ['vendor_*'] }), []);
});

test('exit codes follow the fail-on threshold', () => {
  const results = [{ findings: [{ severity: 'warning' }], error: null }];
  assert.equal(exitCodeFor(results, 'error'), 0);
  assert.equal(exitCodeFor(results, 'warning'), 1);
  assert.equal(exitCodeFor(results, 'none'), 0);
  assert.equal(exitCodeFor([{ findings: [], error: 'bad xml' }], 'error'), 2);
});

test('maskScript preserves offsets and newlines', () => {
  const code = "var a = 'x // y'; /* c\nd */ b(); // e";
  const { noComments, noStrings } = maskScript(code);
  assert.equal(noComments.length, code.length);
  assert.equal(noStrings.length, code.length);
  assert.ok(noComments.includes("'x // y'"));
  assert.ok(!noStrings.includes('x // y'));
  assert.equal(noStrings.split('\n').length, 2);
});
