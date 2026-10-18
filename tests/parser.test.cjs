const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

class Position {
  constructor(line, character) {
    this.line = line;
    this.character = character;
  }
}

class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
}

class SemanticTokensBuilder {
  constructor() {
    this.tokens = [];
  }

  push(range, tokenType, tokenModifiers = []) {
    this.tokens.push({
      line: range.start.line,
      character: range.start.character,
      length: range.end.character - range.start.character,
      tokenType,
      tokenModifiers
    });
  }

  build() {
    return this.tokens;
  }
}

class SemanticTokensLegend {
  constructor(tokenTypes, tokenModifiers) {
    this.tokenTypes = tokenTypes;
    this.tokenModifiers = tokenModifiers;
  }
}

const vscodeMock = { Position, Range, SemanticTokensBuilder, SemanticTokensLegend };
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  return request === 'vscode' ? vscodeMock : originalLoad.call(this, request, parent, isMain);
};

const { KriaParser } = require('../out/utils/parser.js');
const { SemanticTokensProvider } = require('../out/providers/semanticTokensProvider.js');

class TextDocument {
  constructor(text) {
    this.text = text;
    this.version = 1;
    this.uri = { fsPath: 'C:\\workspace\\main.krx' };
  }

  getText(range) {
    if (!range) return this.text;
    return this.text.slice(this.offsetAt(range.start), this.offsetAt(range.end));
  }

  lineAt(line) {
    return { text: this.text.split(/\r\n|\r|\n/)[line] };
  }

  positionAt(offset) {
    const prefix = this.text.slice(0, offset);
    const lines = prefix.split(/\r\n|\r|\n/);
    return new Position(lines.length - 1, lines[lines.length - 1].length);
  }

  offsetAt(position) {
    const lines = this.text.split(/\r\n|\r|\n/);
    let offset = 0;
    for (let i = 0; i < position.line; i++) offset += lines[i].length + 1;
    return offset + position.character;
  }
}

test('ignores declarations and references inside comments and strings', () => {
  const document = new TextDocument(
    '// fn hidden() { set ghost = 1 }\n' +
    'set text = "fn phantom() { set absent = 1 }"\n' +
    'fn visible() { return text }\n'
  );
  const analysis = KriaParser.analyze(document);

  assert.deepEqual(analysis.symbols.filter(symbol => symbol.kind === 'function').map(symbol => symbol.name), ['visible']);
  assert.deepEqual(analysis.symbols.filter(symbol => symbol.kind === 'variable').map(symbol => symbol.name), ['text']);
  assert.deepEqual(analysis.references.map(reference => reference.name), ['text']);
});

test('extracts exported function parameters and references', () => {
  const document = new TextDocument('export fn greet(name) {\n  return name\n}\n');
  const analysis = KriaParser.analyze(document);

  assert.deepEqual(KriaParser.findFunctionDefinitions(document), [{
    name: 'greet',
    params: ['name'],
    line: 0,
    character: 10,
    isExported: true
  }]);
  assert.equal(analysis.symbols.find(symbol => symbol.kind === 'parameter').name, 'name');
  assert.deepEqual(analysis.references.map(reference => reference.name), ['name']);
});

test('finds module imports and excludes member names from local references', () => {
  const document = new TextDocument('import math from "./math.krx"\nmath.add(value)\n');
  const analysis = KriaParser.analyze(document);

  assert.deepEqual(analysis.imports.map(item => ({ name: item.name, path: item.path })), [
    { name: 'math', path: './math.krx' }
  ]);
  assert.equal(analysis.symbols.find(symbol => symbol.kind === 'module').name, 'math');
  assert.deepEqual(analysis.references.map(reference => reference.name), ['math']);
});

test('reports unmatched and unclosed delimiters', () => {
  const analysis = KriaParser.analyze(new TextDocument('fn broken() {\n  print("x")]\n'));

  assert.deepEqual(analysis.delimiters.map(item => ({ value: item.token.value, expected: item.expected })), [
    { value: ']', expected: '}' },
    { value: '{', expected: '}' }
  ]);
});

test('invalidates cached analysis when the document version changes', () => {
  const document = new TextDocument('set before = 1');
  const first = KriaParser.analyze(document);
  document.text = 'set after = 1';
  document.version++;
  const second = KriaParser.analyze(document);

  assert.notEqual(first, second);
  assert.equal(second.symbols[0].name, 'after');
});

test('provides semantic tokens for symbols, built-ins, operators, and input types', () => {
  const document = new TextDocument(
    'export fn greet(name) {\n' +
    '  set local = input<int|float>("age")\n' +
    '  print(name + local)\n' +
    '  return local\n' +
    '}\n' +
    'greet("Ada")\n' +
    'set enabled = true\n'
  );
  const tokens = new SemanticTokensProvider().provideDocumentSemanticTokens(document);
  const sourceWords = tokens.map(token => ({
    ...token,
    value: document.getText().slice(
      document.offsetAt(new Position(token.line, token.character)),
      document.offsetAt(new Position(token.line, token.character)) + token.length
    )
  }));
  const typesFor = value => sourceWords.filter(token => token.value === value).map(token => token.tokenType);

  assert.deepEqual(typesFor('greet'), ['function', 'function']);
  assert.deepEqual(typesFor('name'), ['parameter', 'parameter']);
  assert.deepEqual(typesFor('local'), ['variable', 'variable', 'variable']);
  assert.deepEqual(typesFor('input'), ['function']);
  assert.deepEqual(typesFor('int'), ['type']);
  assert.deepEqual(typesFor('float'), ['type']);
  assert.deepEqual(typesFor('+'), ['operator']);
  assert.deepEqual(typesFor('return'), ['keyword']);
  assert.deepEqual(typesFor('true'), ['enumMember']);
  assert.deepEqual(tokens.find(token => token.tokenType === 'function' && token.tokenModifiers.includes('defaultLibrary'))?.tokenModifiers, ['defaultLibrary']);
});

test('splits multiline string tokens into valid single-line semantic tokens', () => {
  const document = new TextDocument('set text = """first line\nsecond line"""');
  const tokens = new SemanticTokensProvider().provideDocumentSemanticTokens(document);
  const strings = tokens.filter(token => token.tokenType === 'string');

  assert.equal(strings.length, 2);
  assert.deepEqual(strings.map(token => token.line), [0, 1]);
  assert.ok(strings.every(token => token.length > 0));
});
