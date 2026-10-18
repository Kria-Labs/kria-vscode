import * as path from 'path';
import * as vscode from 'vscode';

export type KriaTokenKind = 'identifier' | 'string' | 'number' | 'symbol' | 'newline';

export interface KriaToken {
  kind: KriaTokenKind;
  value: string;
  start: number;
  end: number;
}

export interface KriaSymbol {
  name: string;
  kind: 'function' | 'variable' | 'parameter' | 'module';
  declaration: vscode.Range;
  declarations: vscode.Range[];
  scope: vscode.Range;
  params: string[];
  isExported: boolean;
  importPath?: string;
  isCallable?: boolean;
}

export interface KriaImport {
  name: string;
  path: string;
  range: vscode.Range;
}

export interface KriaReference {
  name: string;
  range: vscode.Range;
  symbol: KriaSymbol;
}

export interface KriaAnalysis {
  tokens: KriaToken[];
  symbols: KriaSymbol[];
  imports: KriaImport[];
  references: KriaReference[];
  delimiters: Array<{ token: KriaToken; expected: string | null }>;
}

const keywords = new Set([
  'if', 'elseif', 'else', 'while', 'for', 'in', 'fn', 'set', 'return',
  'break', 'continue', 'export', 'import', 'from', 'and', 'or', 'not',
  'true', 'false', 'null'
]);

export const builtinNames = new Set(['print', 'input', 'push', 'pop', 'rmv', 'type', 'wait']);

function tokenize(text: string): KriaToken[] {
  const tokens: KriaToken[] = [];
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '\r' || char === '\n') {
      const start = index;
      if (char === '\r' && next === '\n') index += 2;
      else index++;
      tokens.push({ kind: 'newline', value: '\n', start, end: index });
      continue;
    }

    if (/\s/.test(char)) {
      index++;
      continue;
    }

    if (char === '/' && next === '/') {
      while (index < text.length && text[index] !== '\r' && text[index] !== '\n') index++;
      continue;
    }

    if (char === '/' && next === '*') {
      index += 2;
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) index++;
      if (index < text.length) index += 2;
      continue;
    }

    if (char === '"') {
      const start = index;
      const triple = text.startsWith('"""', index);
      const delimiter = triple ? '"""' : '"';
      index += delimiter.length;
      while (index < text.length) {
        if (text[index] === '\\') {
          index = Math.min(index + 2, text.length);
        } else if (text.startsWith(delimiter, index)) {
          index += delimiter.length;
          break;
        } else if (!triple && (text[index] === '\r' || text[index] === '\n')) {
          break;
        } else {
          index++;
        }
      }
      tokens.push({ kind: 'string', value: text.slice(start, index), start, end: index });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = index++;
      while (index < text.length && /[A-Za-z0-9_]/.test(text[index])) index++;
      tokens.push({ kind: 'identifier', value: text.slice(start, index), start, end: index });
      continue;
    }

    if (/\d/.test(char) || (char === '.' && /\d/.test(next || ''))) {
      const start = index++;
      while (index < text.length && /[A-Za-z0-9_.+-]/.test(text[index])) {
        if ((text[index] === '+' || text[index] === '-') && !/[eE]$/.test(text.slice(start, index))) break;
        index++;
      }
      tokens.push({ kind: 'number', value: text.slice(start, index), start, end: index });
      continue;
    }

    const start = index;
    const pair = text.slice(index, index + 2);
    if (['==', '!=', '>=', '<='].includes(pair)) index += 2;
    else index++;
    tokens.push({ kind: 'symbol', value: text.slice(start, index), start, end: index });
  }

  return tokens;
}

function isIdentifier(token: KriaToken | undefined): token is KriaToken {
  return token?.kind === 'identifier';
}

export class KriaParser {
  private static readonly analysisCache = new WeakMap<vscode.TextDocument, { version: number; analysis: KriaAnalysis }>();

  static analyze(document: vscode.TextDocument): KriaAnalysis {
    const cached = this.analysisCache.get(document);
    if (cached?.version === document.version) return cached.analysis;

    const text = document.getText();
    const tokens = tokenize(text);
    const symbols: KriaSymbol[] = [];
    const imports: KriaImport[] = [];
    const delimiterStack: Array<{ token: KriaToken; index: number; expected: string }> = [];
    const delimiters: KriaAnalysis['delimiters'] = [];
    const pairForOpen = new Map<number, number>();

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.kind !== 'symbol') continue;
      if (token.value === '(' || token.value === '[' || token.value === '{') {
        delimiterStack.push({
          token,
          index: i,
          expected: token.value === '(' ? ')' : token.value === '[' ? ']' : '}'
        });
      } else if (token.value === ')' || token.value === ']' || token.value === '}') {
        const last = delimiterStack[delimiterStack.length - 1];
        if (!last || last.expected !== token.value) {
          delimiters.push({ token, expected: last?.expected ?? null });
        } else {
          delimiterStack.pop();
          pairForOpen.set(last.index, i);
          pairForOpen.set(i, last.index);
        }
      }
    }
    delimiters.push(...delimiterStack.map(({ token, expected }) => ({ token, expected })));

    const functionScopes: Array<{ start: number; end: number; params: KriaToken[] }> = [];
    for (let i = 0; i < tokens.length; i++) {
      let nameIndex = i;
      let openIndex: number;
      let exported = false;
      if (tokens[i].value === 'export' && tokens[i + 1]?.value === 'fn') {
        nameIndex = i + 2;
        exported = true;
      } else if (tokens[i].value !== 'fn') {
        continue;
      } else {
        nameIndex = i + 1;
      }

      const isAnonymous = tokens[nameIndex]?.value === '(' && tokens[i].value === 'fn';
      if (isAnonymous) {
        openIndex = nameIndex;
      } else {
        if (!isIdentifier(tokens[nameIndex]) || tokens[nameIndex + 1]?.value !== '(') continue;
        openIndex = nameIndex + 1;
      }
      const closeIndex = pairForOpen.get(openIndex);
      if (closeIndex === undefined) continue;

      const paramTokens = tokens.slice(openIndex + 1, closeIndex)
        .filter(candidate => isIdentifier(candidate) && !keywords.has(candidate.value));
      const params = paramTokens.map(token => token.value);

      let bodyOpen = closeIndex + 1;
      while (tokens[bodyOpen] && tokens[bodyOpen].kind === 'newline') bodyOpen++;
      const bodyClose = tokens[bodyOpen]?.value === '{' ? pairForOpen.get(bodyOpen) : undefined;
      const scopeStart = bodyOpen < tokens.length ? tokens[bodyOpen].start : tokens[nameIndex].start;
      const scopeEnd = bodyClose === undefined ? text.length : tokens[bodyClose].end;
      functionScopes.push({ start: scopeStart, end: scopeEnd, params: paramTokens });

      if (!isAnonymous) {
        const name = tokens[nameIndex];
        symbols.push({
          name: name.value,
          kind: 'function',
          declaration: this.range(document, name),
          declarations: [this.range(document, name)],
          scope: new vscode.Range(document.positionAt(0), document.positionAt(text.length)),
          params,
          isExported: exported
        });
        i = nameIndex;
      }
    }

    const globalSymbols = new Map<string, KriaSymbol>();
    for (const symbol of symbols) globalSymbols.set(symbol.name, symbol);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.value === 'import' && isIdentifier(tokens[i + 1]) &&
        tokens[i + 2]?.value === 'from' && tokens[i + 3]?.kind === 'string') {
        const alias = tokens[i + 1];
        const pathToken = tokens[i + 3];
        const importPath = pathToken.value.slice(1, pathToken.value.startsWith('"""') ? -3 : -1);
        const range = this.range(document, alias);
        imports.push({ name: alias.value, path: importPath, range });
        const existing = globalSymbols.get(alias.value);
        if (existing) {
          existing.declarations.push(range);
        } else {
          const symbol: KriaSymbol = {
            name: alias.value,
            kind: 'module',
            declaration: range,
            declarations: [range],
            scope: new vscode.Range(document.positionAt(0), document.positionAt(text.length)),
            params: [],
            isExported: false,
            importPath
          };
          symbols.push(symbol);
          globalSymbols.set(symbol.name, symbol);
        }
      }

      if (token.value === 'set' && isIdentifier(tokens[i + 1]) && tokens[i + 2]?.value === '=') {
        const nameToken = tokens[i + 1];
        const localScope = functionScopes
          .filter(scope => nameToken.start >= scope.start && nameToken.start <= scope.end)
          .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
        if (localScope?.params.some(param => param.value === nameToken.value)) continue;

        const isCallable = tokens[i + 3]?.value === 'fn' && tokens[i + 4]?.value === '(';
        const callableOpen = isCallable ? i + 4 : -1;
        const callableClose = isCallable ? pairForOpen.get(callableOpen) : undefined;
        const callableParams = callableClose === undefined
          ? []
          : tokens.slice(callableOpen + 1, callableClose)
            .filter(candidate => isIdentifier(candidate) && !keywords.has(candidate.value))
            .map(candidate => candidate.value);
        const range = this.range(document, nameToken);
        const existing = globalSymbols.get(nameToken.value);
        if (existing && existing.kind === 'variable') {
          existing.declarations.push(range);
          existing.isCallable = isCallable;
          existing.params = callableParams;
        } else if (!existing) {
          const symbol: KriaSymbol = {
            name: nameToken.value,
            kind: 'variable',
            declaration: range,
            declarations: [range],
            scope: new vscode.Range(document.positionAt(0), document.positionAt(text.length)),
            params: callableParams,
            isExported: false,
            isCallable
          };
          symbols.push(symbol);
          globalSymbols.set(symbol.name, symbol);
        }
      }
    }

    for (const scope of functionScopes) {
      for (const token of scope.params) {
        const param = token.value;
        const range = this.range(document, token);
        symbols.push({
          name: param,
          kind: 'parameter',
          declaration: range,
          declarations: [range],
          scope: new vscode.Range(document.positionAt(scope.start), document.positionAt(scope.end)),
          params: [],
          isExported: false
        });
      }
    }

    const declarationStarts = new Set(symbols.flatMap(symbol => symbol.declarations.map(range => document.offsetAt(range.start))));
    const references: KriaReference[] = [];
    for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
      const token = tokens[tokenIndex];
      if (!isIdentifier(token) || keywords.has(token.value) || builtinNames.has(token.value)) continue;
      const offset = token.start;
      if (declarationStarts.has(offset)) continue;

      if (tokens[tokenIndex - 1]?.value === '.' ||
        (tokens[tokenIndex + 1]?.value === ':' && tokens[tokenIndex - 1]?.value !== '?')) continue;

      const localScope = functionScopes
        .filter(scope => offset >= scope.start && offset <= scope.end && scope.params.some(param => param.value === token.value))
        .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
      const symbol = localScope
        ? symbols.find(candidate => candidate.kind === 'parameter' &&
          candidate.name === token.value &&
          document.offsetAt(candidate.scope.start) === localScope.start)
        : globalSymbols.get(token.value);
      if (symbol) references.push({ name: token.value, range: this.range(document, token), symbol });
    }

    const analysis = { tokens, symbols, imports, references, delimiters };
    this.analysisCache.set(document, { version: document.version, analysis });
    return analysis;
  }

  static findSymbolAt(document: vscode.TextDocument, position: vscode.Position): KriaSymbol | undefined {
    const analysis = this.analyze(document);
    const offset = document.offsetAt(position);
    const reference = analysis.references.find(item => offset >= document.offsetAt(item.range.start) && offset <= document.offsetAt(item.range.end));
    if (reference) return reference.symbol;
    return analysis.symbols.find(symbol => symbol.declarations.some(range =>
      offset >= document.offsetAt(range.start) && offset <= document.offsetAt(range.end)
    ));
  }

  static findFunctionDefinitions(document: vscode.TextDocument): FunctionDefinition[] {
    return this.analyze(document).symbols
      .filter(symbol => symbol.kind === 'function')
      .map(symbol => ({
        name: symbol.name,
        params: symbol.params,
        line: symbol.declaration.start.line,
        character: symbol.declaration.start.character,
        isExported: symbol.isExported
      }));
  }

  static findVariableDeclarations(document: vscode.TextDocument): VariableDefinition[] {
    return this.analyze(document).symbols
      .filter(symbol => symbol.kind === 'variable')
      .map(symbol => ({
        name: symbol.name,
        line: symbol.declaration.start.line,
        character: symbol.declaration.start.character
      }));
  }

  static getWordAtPosition(document: vscode.TextDocument, position: vscode.Position): string | null {
    const range = document.getWordRangeAtPosition(position, /[A-Za-z_]\w*/);
    return range ? document.getText(range) : null;
  }

  static getLineAtPosition(document: vscode.TextDocument, position: vscode.Position): string {
    return document.lineAt(position.line).text;
  }

  static isKeyword(word: string): boolean {
    return keywords.has(word);
  }

  static isBuiltInFunction(word: string): boolean {
    return builtinNames.has(word);
  }

  static getSymbolType(document: vscode.TextDocument, position: vscode.Position): SymbolType {
    return this.findSymbolAt(document, position)?.kind ?? 'unknown';
  }

  static findImportStatement(document: vscode.TextDocument, moduleName: string): ImportDefinition | null {
    const found = this.analyze(document).imports.find(item => item.name === moduleName);
    return found ? { name: found.name, path: found.path } : null;
  }

  static resolveImportPath(currentFile: string, importPath: string): string {
    return path.resolve(path.dirname(currentFile), importPath);
  }

  private static range(document: vscode.TextDocument, token: KriaToken): vscode.Range {
    return new vscode.Range(document.positionAt(token.start), document.positionAt(token.end));
  }
}

export interface FunctionDefinition {
  name: string;
  params: string[];
  line: number;
  character: number;
  isExported: boolean;
}

export interface VariableDefinition {
  name: string;
  line: number;
  character: number;
}

export interface ImportDefinition {
  name: string;
  path: string;
}

export type SymbolType = KriaSymbol['kind'] | 'unknown';
