import * as vscode from 'vscode';
import { BUILTIN_FUNCTIONS } from '../utils/definitions';
import { KriaParser } from '../utils/parser';

interface Callable {
  name: string;
  params: string[];
  documentation?: string;
}

export class SignatureHelpProvider implements vscode.SignatureHelpProvider {
  async provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.SignatureHelp | undefined> {
    const tokens = KriaParser.analyze(document).tokens.filter(token => token.end <= document.offsetAt(position));
    const delimiterStack: Array<{ index: number; value: string }> = [];

    for (let i = 0; i < tokens.length; i++) {
      const value = tokens[i].value;
      if (value === '(' || value === '[' || value === '{') delimiterStack.push({ index: i, value });
      else if (value === ')' || value === ']' || value === '}') {
        const expected = value === ')' ? '(' : value === ']' ? '[' : '{';
        if (delimiterStack[delimiterStack.length - 1]?.value === expected) delimiterStack.pop();
      }
    }

    const activeCall = [...delimiterStack].reverse().find(item => item.value === '(');
    if (!activeCall) return undefined;
    const callTokens = tokens.slice(0, activeCall.index);
    const callableToken = callTokens[callTokens.length - 1];
    if (!callableToken || callableToken.kind !== 'identifier') return undefined;

    let callable = this.findLocalCallable(document, callableToken.value);
    const maybeAlias = callTokens[callTokens.length - 2];
    if (maybeAlias?.value === '.') {
      const aliasToken = callTokens[callTokens.length - 3];
      const imported = aliasToken?.kind === 'identifier'
        ? KriaParser.findImportStatement(document, aliasToken.value)
        : null;
      if (imported) {
        const modulePath = KriaParser.resolveImportPath(document.uri.fsPath, imported.path);
        const moduleDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(modulePath));
        const exported = KriaParser.findFunctionDefinitions(moduleDocument)
          .find(func => func.name === callableToken.value && func.isExported);
        callable = exported
          ? { name: exported.name, params: exported.params }
          : undefined;
      }
    }

    if (!callable) return undefined;
    const activeParameter = this.countTopLevelArguments(tokens, activeCall.index + 1);
    const signature = new vscode.SignatureInformation(
      `${callable.name}(${callable.params.join(', ')})`,
      callable.documentation
    );
    signature.parameters = callable.params.map(param => new vscode.ParameterInformation(param));

    const help = new vscode.SignatureHelp();
    help.signatures = [signature];
    help.activeSignature = 0;
    help.activeParameter = Math.min(activeParameter, Math.max(callable.params.length - 1, 0));
    return help;
  }

  private findLocalCallable(document: vscode.TextDocument, name: string): Callable | undefined {
    const builtin = BUILTIN_FUNCTIONS[name as keyof typeof BUILTIN_FUNCTIONS];
    if (builtin) {
      const params: Record<string, string[]> = {
        print: ['value'],
        input: ['prompt'],
        push: ['array', 'item'],
        pop: ['array'],
        rmv: ['object.property'],
        type: ['value'],
        wait: ['milliseconds']
      };
      return { name, params: params[name], documentation: builtin.documentation };
    }

    const definition = KriaParser.findFunctionDefinitions(document).find(func => func.name === name);
    if (definition) return { name, params: definition.params };
    const callable = KriaParser.analyze(document).symbols.find(symbol =>
      symbol.name === name && symbol.kind === 'variable' && symbol.isCallable
    );
    return callable ? { name, params: callable.params } : undefined;
  }

  private countTopLevelArguments(tokens: ReturnType<typeof KriaParser.analyze>['tokens'], start: number): number {
    let nested = 0;
    let commas = 0;
    for (let i = start; i < tokens.length; i++) {
      const value = tokens[i].value;
      if (value === '(' || value === '[' || value === '{') nested++;
      else if (value === ')' || value === ']' || value === '}') {
        if (nested === 0) break;
        nested--;
      } else if (value === ',' && nested === 0) {
        commas++;
      }
    }
    return commas;
  }
}
