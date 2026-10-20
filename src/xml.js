'use strict';

/**
 * Minimal, dependency-free XML parser tailored to ServiceNow unload / update set files.
 *
 * Supports: elements, attributes, text, CDATA, comments, processing instructions,
 * the five predefined entities and numeric character references.
 *
 * Deliberately NOT supported: DOCTYPE declarations and custom entities. Rejecting them
 * removes the whole class of XXE / entity-expansion attacks when linting untrusted files.
 *
 * Every element records the line its start tag begins on (`line`) and the line its
 * text content begins on (`textLine`), so findings can point at real file lines.
 */

const PREDEFINED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

class XmlParseError extends Error {
  constructor(message, line) {
    super(`${message} (line ${line})`);
    this.name = 'XmlParseError';
    this.line = line;
  }
}

function decodeEntities(str) {
  if (str.indexOf('&') === -1) return str;
  return str.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, ent) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      try {
        return String.fromCodePoint(code);
      } catch (_) {
        return match;
      }
    }
    return Object.prototype.hasOwnProperty.call(PREDEFINED, ent) ? PREDEFINED[ent] : match;
  });
}

/** Find the closing '>' of a start tag, ignoring '>' inside quoted attribute values. */
function findTagEnd(text, from) {
  let quote = null;
  for (let k = from; k < text.length; k++) {
    const ch = text[k];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return k;
    }
  }
  return -1;
}

function parseAttributes(body) {
  const attrs = {};
  const re = /([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    attrs[m[1]] = decodeEntities(m[2] !== undefined ? m[2] : m[3]);
  }
  return attrs;
}

function makeElement(name, attrs, line, parent) {
  return { name, attrs, line, textLine: null, text: '', children: [], parent };
}

/**
 * Parse XML text into a lightweight element tree.
 * @param {string} text
 * @param {{lineOffset?: number}} [options] lineOffset shifts reported lines (used for nested payloads)
 */
function parseXml(text, options = {}) {
  const lineOffset = options.lineOffset || 0;
  let i = 0;
  let line = 1 + lineOffset;
  const root = makeElement('#document', {}, line, null);
  const stack = [root];

  const advanceTo = (j) => {
    for (let k = i; k < j; k++) if (text.charCodeAt(k) === 10) line++;
    i = j;
  };
  const appendText = (value, startLine) => {
    const top = stack[stack.length - 1];
    if (top === root) {
      if (value.trim()) throw new XmlParseError('Text outside of root element', startLine);
      return;
    }
    if (top.textLine === null) top.textLine = startLine;
    top.text += value;
  };

  while (i < text.length) {
    const lt = text.indexOf('<', i);
    if (lt === -1) {
      const startLine = line;
      const rest = text.slice(i);
      advanceTo(text.length);
      appendText(decodeEntities(rest), startLine);
      break;
    }
    if (lt > i) {
      const startLine = line;
      const chunk = text.slice(i, lt);
      advanceTo(lt);
      appendText(decodeEntities(chunk), startLine);
    }

    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4);
      if (end === -1) throw new XmlParseError('Unterminated comment', line);
      advanceTo(end + 3);
    } else if (text.startsWith('<![CDATA[', i)) {
      const end = text.indexOf(']]>', i + 9);
      if (end === -1) throw new XmlParseError('Unterminated CDATA section', line);
      const startLine = line;
      const value = text.slice(i + 9, end);
      advanceTo(end + 3);
      appendText(value, startLine);
    } else if (text.startsWith('<?', i)) {
      const end = text.indexOf('?>', i + 2);
      if (end === -1) throw new XmlParseError('Unterminated processing instruction', line);
      advanceTo(end + 2);
    } else if (text.startsWith('<!', i)) {
      throw new XmlParseError('DOCTYPE and entity declarations are not supported', line);
    } else if (text.startsWith('</', i)) {
      const end = text.indexOf('>', i);
      if (end === -1) throw new XmlParseError('Unterminated end tag', line);
      const name = text.slice(i + 2, end).trim();
      const top = stack.pop();
      if (!top || top === root || top.name !== name) {
        throw new XmlParseError(`Unexpected closing tag </${name}>`, line);
      }
      advanceTo(end + 1);
    } else {
      const end = findTagEnd(text, i + 1);
      if (end === -1) throw new XmlParseError('Unterminated start tag', line);
      const startLine = line;
      let body = text.slice(i + 1, end);
      const selfClosing = body.endsWith('/');
      if (selfClosing) body = body.slice(0, -1);
      const nameMatch = /^[^\s/>]+/.exec(body);
      if (!nameMatch) throw new XmlParseError('Malformed start tag', line);
      advanceTo(end + 1);
      const parent = stack[stack.length - 1];
      if (parent === root && root.children.length > 0) {
        throw new XmlParseError('Multiple root elements', startLine);
      }
      const el = makeElement(nameMatch[0], parseAttributes(body.slice(nameMatch[0].length)), startLine, parent);
      el.textLine = line;
      parent.children.push(el);
      if (!selfClosing) {
        el.textLine = null;
        el.contentLine = line;
        stack.push(el);
      }
    }
  }

  if (stack.length > 1) {
    throw new XmlParseError(`Unclosed element <${stack[stack.length - 1].name}>`, line);
  }
  return root;
}

/** First direct child with the given name, or undefined. */
function child(el, name) {
  return el.children.find((c) => c.name === name);
}

/** Text line for an element; falls back to the line after its start tag. */
function textLineOf(el) {
  if (el.textLine !== null && el.textLine !== undefined) return el.textLine;
  return el.contentLine || el.line;
}

module.exports = { parseXml, decodeEntities, child, textLineOf, XmlParseError };
