import * as vscode from 'vscode';
import { BUILTIN_FUNCTIONS, KEYWORDS } from '../utils/definitions';
import { KriaParser } from '../utils/parser';
import { resolveImportedFunctionAt } from '../utils/moduleResolver';

export class HoverProvider implements vscode.HoverProvider {
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Hover | undefined> {
    const word = KriaParser.getWordAtPosition(document, position);
    if (!word) return undefined;

    if (Object.prototype.hasOwnProperty.call(BUILTIN_FUNCTIONS, word)) {
      const func = BUILTIN_FUNCTIONS[word as keyof typeof BUILTIN_FUNCTIONS];
      const markdown = new vscode.MarkdownString();
      markdown.appendCodeblock(func.signature, 'kria');
      markdown.appendMarkdown(`\n${func.documentation}`);
      return new vscode.Hover(markdown);
    }

    if (Object.prototype.hasOwnProperty.call(KEYWORDS, word)) {
      const keyword = KEYWORDS[word as keyof typeof KEYWORDS];
      const markdown = new vscode.MarkdownString();
      markdown.appendMarkdown(`**${word}** — Kria keyword\n\n${keyword.documentation}`);
      return new vscode.Hover(markdown);
    }

    const imported = await resolveImportedFunctionAt(document, position);
    if (imported) {
      const markdown = new vscode.MarkdownString();
      markdown.appendCodeblock(
        `fn ${imported.definition.name}(${imported.definition.params.join(', ')})`,
        'kria'
      );
      markdown.appendMarkdown(`\nExported by \`${imported.moduleAlias}\` · ${imported.document.uri.fsPath}`);
      return new vscode.Hover(markdown);
    }

    const symbol = KriaParser.findSymbolAt(document, position);
    if (!symbol) return undefined;

    const markdown = new vscode.MarkdownString();
    if (symbol.kind === 'function') {
      markdown.appendCodeblock(`fn ${symbol.name}(${symbol.params.join(', ')})`, 'kria');
      if (symbol.isExported) markdown.appendMarkdown('\n*(exported)*');
    } else if (symbol.kind === 'parameter') {
      markdown.appendMarkdown(`**${symbol.name}** — Function parameter`);
    } else if (symbol.kind === 'module') {
      markdown.appendMarkdown(`**${symbol.name}** — Imported module\n\n\`${symbol.importPath}\``);
    } else if (symbol.kind === 'variable' && symbol.isCallable) {
      markdown.appendCodeblock(`fn ${symbol.name}(${symbol.params.join(', ')})`, 'kria');
      markdown.appendMarkdown('\n*(anonymous function)*');
    } else {
      markdown.appendMarkdown(`**${symbol.name}** — Variable`);
    }
    markdown.appendMarkdown(`\n\nDefined at line ${symbol.declaration.start.line + 1}`);
    return new vscode.Hover(markdown);
  }
}
