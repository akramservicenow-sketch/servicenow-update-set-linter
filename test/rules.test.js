'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { lint, ruleIds } = require('../test-support/helpers');

const br = (when, script, extra = {}) => ({ table: 'sys_script', fields: { when, collection: 'incident', ...extra }, script });
const client = (script) => ({ table: 'sys_script_client', fields: { type: 'onChange', table: 'incident' }, script });
const include = (script, scope = 'global') => ({ table: 'sys_script_include', script, scope });

test('SN001 flags current.update() in after Business Rules', () => {
  const findings = lint(br('after', 'current.state = 2;\ncurrent.update();')).filter((f) => f.ruleId === 'SN001');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2);
  assert.match(findings[0].message, /recursion/);
});

test('SN001 flags current.update() in before Business Rules with a specific message', () => {
  const [f] = lint(br('before', 'current.update();')).filter((x) => x.ruleId === 'SN001');
  assert.match(f.message, /redundant/);
});

test('SN001 ignores async rules, comments and strings', () => {
  assert.ok(!ruleIds(br('async', 'current.update();')).includes('SN001'));
  assert.ok(!ruleIds(br('after', '// current.update();\nvar s = "current.update()";')).includes('SN001'));
});

test('SN002 flags GlideRecord in client scripts', () => {
  assert.ok(ruleIds(client("var gr = new GlideRecord('sys_user');")).includes('SN002'));
});

test('SN002 skips client UI Actions with a server-side branch', () => {
  const script = "function c(){ gsftSubmit(); }\nif (typeof window == 'undefined') { var gr = new GlideRecord('task'); }";
  assert.ok(!ruleIds({ table: 'sys_ui_action', fields: { client: 'true' }, script }).includes('SN002'));
  // Without the guard the same code is reported.
  assert.ok(ruleIds({ table: 'sys_ui_action', fields: { client: 'true' }, script: "var gr = new GlideRecord('task');" }).includes('SN002'));
});

test('SN002 does not apply to server-side code', () => {
  assert.ok(!ruleIds(include("var gr = new GlideRecord('task');")).includes('SN002'));
});

test('SN003 flags getXMLWait and getReference without callback', () => {
  const ids = ruleIds(client("ga.getXMLWait();\nvar u = g_form.getReference('caller_id');"));
  assert.equal(ids.filter((id) => id === 'SN003').length, 2);
});

test('SN003 accepts asynchronous patterns', () => {
  const ids = ruleIds(client("ga.getXMLAnswer(cb);\ng_form.getReference('caller_id', function(u) {});"));
  assert.ok(!ids.includes('SN003'));
});

test('SN004 flags hard-coded sys_id literals', () => {
  const [f] = lint(include("var g = 'c0ffee000000000000000000000000aa';")).filter((x) => x.ruleId === 'SN004');
  assert.ok(f);
  assert.equal(f.column, 9);
});

test('SN004 honours the allow-list option and ignores commented ids', () => {
  const script = "var g = 'c0ffee000000000000000000000000aa';\n// 'c0ffee000000000000000000000000bb'";
  const ids = ruleIds(include(script), { rules: { SN004: { options: { allow: ['C0FFEE000000000000000000000000AA'] } } } });
  assert.ok(!ids.includes('SN004'));
});

test('SN005 flags gs.log in scoped code but not in global code', () => {
  assert.ok(ruleIds(include("gs.log('x');", 'x_demo_app')).includes('SN005'));
  assert.ok(!ruleIds(include("gs.log('x');")).includes('SN005'));
});

test('SN005 does not double-report scoped gs.log as debug logging', () => {
  assert.ok(!ruleIds(include("gs.log('x');", 'x_demo_app')).includes('SN006'));
});

test('SN006 flags console.log, alert and jslog in client scripts', () => {
  const ids = ruleIds(client("console.log(1);\nalert('hi');\njslog('x');"));
  assert.equal(ids.filter((id) => id === 'SN006').length, 3);
});

test('SN006 ignores g_form message APIs and identifiers containing alert', () => {
  const ids = ruleIds(client("g_form.addInfoMessage('x');\nshowAlert();\nwindow.myalert(1);"));
  assert.ok(!ids.includes('SN006'));
});

test('SN007 flags GlideRecord created inside a while loop', () => {
  const script = `var a = new GlideRecord('task');
a.addActiveQuery();
a.query();
while (a.next()) {
  var b = new GlideRecord('sys_user');
  b.get(a.getValue('assigned_to'));
}`;
  const [f] = lint(include(script)).filter((x) => x.ruleId === 'SN007');
  assert.equal(f.line, 5);
});

test('SN007 flags queries inside forEach callbacks and for loops', () => {
  const script = "ids.forEach(function(id) {\n var g = new GlideAggregate('task');\n});\nfor (var i = 0; i < 3; i++) {\n var r = new GlideRecord('x');\n}";
  assert.equal(ruleIds(include(script)).filter((id) => id === 'SN007').length, 2);
});

test('SN007 does not flag sequential queries', () => {
  const script = "var a = new GlideRecord('task');\na.addActiveQuery();\na.query();\nwhile (a.next()) { count++; }\nvar b = new GlideRecord('sys_user');";
  assert.ok(!ruleIds(include(script)).includes('SN007'));
});

test('SN008 flags single-row lookups without setLimit', () => {
  const script = "var u = new GlideRecord('sys_user');\nu.addQuery('user_name', name);\nu.query();\nif (u.next()) { return u; }";
  assert.ok(ruleIds(include(script)).includes('SN008'));
});

test('SN008 accepts setLimit(1) and while loops', () => {
  const limited = "var u = new GlideRecord('sys_user');\nu.addQuery('a', 1);\nu.setLimit(1);\nu.query();\nif (u.next()) {}";
  const looped = "var u = new GlideRecord('sys_user');\nu.addQuery('a', 1);\nu.query();\nwhile (u.next()) {}";
  assert.ok(!ruleIds(include(limited)).includes('SN008'));
  assert.ok(!ruleIds(include(looped)).includes('SN008'));
});

test('SN009 flags query() with no filter', () => {
  const [f] = lint(include("var t = new GlideRecord('task');\nt.query();")).filter((x) => x.ruleId === 'SN009');
  assert.match(f.message, /full table scan/);
  assert.match(f.message, /'task'/);
});

test('SN009 flags unfiltered deleteMultiple() as table-wide', () => {
  const [f] = lint(include("var t = new GlideRecord('u_staging');\nt.deleteMultiple();")).filter((x) => x.ruleId === 'SN009');
  assert.match(f.message, /every row/);
});

test('SN009 accepts filtered queries and get()', () => {
  assert.ok(!ruleIds(include("var t = new GlideRecord('task');\nt.addEncodedQuery('active=true');\nt.query();")).includes('SN009'));
  assert.ok(!ruleIds(include("var t = new GlideRecord('task');\nt.get(id);")).includes('SN009'));
});

test('SN010 flags eval, new Function and GlideEvaluator', () => {
  const ids = ruleIds(include("eval(x);\nvar f = new Function('a', 'return a');\nGlideEvaluator.evaluateString(s);"));
  assert.equal(ids.filter((id) => id === 'SN010').length, 3);
});

test('SN010 ignores methods named eval on other objects', () => {
  assert.ok(!ruleIds(include('calculator.eval(x);\nmyeval(y);')).includes('SN010'));
});

test('SN011 flags DOM access in client scripts', () => {
  const ids = ruleIds(client("document.getElementById('x');\ngel('y');\n$j('#z');\njQuery('a');\nel.innerHTML = 'b';"));
  assert.equal(ids.filter((id) => id === 'SN011').length, 5);
});

test('SN011 ignores g_form usage', () => {
  assert.ok(!ruleIds(client("g_form.setDisplay('x', false);\ng_form.flash('y', '#FF0000', 0);")).includes('SN011'));
});

test('SN012 flags Business Rules on the global table even without a script', () => {
  const findings = lint({ table: 'sys_script', fields: { when: 'before', collection: 'global' } });
  assert.deepEqual(findings.map((f) => f.ruleId), ['SN012']);
});

test('SN013 flags empty catch blocks including comment-only ones', () => {
  const ids = ruleIds(include('try { a(); } catch (e) {}\ntry { b(); } catch (err) { /* nothing */ }'));
  assert.equal(ids.filter((id) => id === 'SN013').length, 2);
});

test('SN013 accepts catch blocks that handle the error', () => {
  assert.ok(!ruleIds(include("try { a(); } catch (e) { gs.error(e.message); }")).includes('SN013'));
});

test('SN014 flags getRowCount()', () => {
  assert.ok(ruleIds(include("var t = new GlideRecord('task');\nt.addActiveQuery();\nt.query();\nvar n = t.getRowCount();")).includes('SN014'));
});
