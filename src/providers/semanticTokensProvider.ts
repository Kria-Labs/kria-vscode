import * as vscode from 'vscode';
import { builtinNames, KriaParser } from '../utils/parser';

export const KRIA_SEMANTIC_TOKEN_TYPES = [
  'function',
  'variable',
  'parameter',
  'namespace',
  'property',
  'keyword',
  'type',
  'enumMember',
  'string',
  'number',
  'operator'
];

export const KRIA_SEMANTIC_TOKEN_MODIFIERS = ['declaration', 'defaultLibrary'];

const operatorValues = new Set(['+', '-', '*', '/', '=', '==', '!=', '>', '<', '>=', '<=']);
const inputTypes = new Set(['str', 'int', 'float']);

function symbolTokenType(kind: string): string {
  switch (kind) {
    case 'function': return 'function';
    case 'parameter': return 'parameter';
    case 'module': return 'namespace';
    default: return 'variable';
  }
}

export class SemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
    const analysis = KriaParser.analyze(document);
    const builder = new vscode.SemanticTokensBuilder(
      new vscode.SemanticTokensLegend(KRIA_SEMANTIC_TOKEN_TYPES, KRIA_SEMANTIC_TOKEN_MODIFIERS)
    );
    const declarationTypes = new Map<number, string>();
    const referenceTypes = new Map<number, string>();
    const inputTypeOffsets = new Set<number>();

    for (const symbol of analysis.symbols) {
      for (const range of symbol.declarations) {
        declarationTypes.set(document.offsetAt(range.start), symbolTokenType(symbol.kind));
      }
    }
    for (const reference of analysis.references) {
      referenceTypes.set(document.offsetAt(reference.range.start), symbolTokenType(reference.symbol.kind));
    }

    for (let i = 0; i < analysis.tokens.length; i++) {
      if (analysis.tokens[i].value !== 'input' || analysis.tokens[i + 1]?.value !== '<') continue;
      for (let j = i + 2; j < analysis.tokens.length && analysis.tokens[j].value !== '>'; j++) {
        if (inputTypes.has(analysis.tokens[j].value)) inputTypeOffsets.add(analysis.tokens[j].start);
      }
    }

    for (let i = 0; i < analysis.tokens.length; i++) {
      const token = analysis.tokens[i];
      let tokenType: string | undefined;
      let modifiers: string[] = [];

      if (token.kind === 'string') tokenType = 'string';
      else if (token.kind === 'number') tokenType = 'number';
      else if (token.kind === 'symbol' && operatorValues.has(token.value)) tokenType = 'operator';
      else if (token.kind === 'identifier') {
        const declarationType = declarationTypes.get(token.start);
        if (declarationType) {
          tokenType = declarationType;
          modifiers = ['declaration'];
        } else if (['true', 'false', 'null'].includes(token.value)) {
          tokenType = 'enumMember';
        } else if (KriaParser.isKeyword(token.value)) {
          tokenType = ['and', 'or', 'not'].includes(token.value) ? 'operator' : 'keyword';
        } else if (inputTypeOffsets.has(token.start)) {
          tokenType = 'type';
        } else if (builtinNames.has(token.value)) {
          tokenType = 'function';
          modifiers = ['defaultLibrary'];
        } else {
          const previous = analysis.tokens[i - 1]?.value;
          const next = analysis.tokens[i + 1]?.value;
          tokenType = referenceTypes.get(token.start) ??
            (next === '(' ? 'function' : previous === '.' || next === ':' ? 'property' : 'variable');
        }
      }

      if (!tokenType) continue;
      const start = document.positionAt(token.start);
      const end = document.positionAt(token.end);
      for (let line = start.line; line <= end.line; line++) {
        const lineText = document.lineAt(line).text;
        const startCharacter = line === start.line ? start.character : 0;
        const endCharacter = line === end.line ? end.character : lineText.length;
        if (endCharacter <= startCharacter) continue;
        builder.push(
          new vscode.Range(
            new vscode.Position(line, startCharacter),
            new vscode.Position(line, endCharacter)
          ),
          tokenType,
          modifiers
        );
      }
    }

    return builder.build();
  }
}
