import * as vscode from 'vscode';
import { KriaParser, KriaToken } from '../utils/parser';

const validInputTypes = new Set(['str', 'int', 'float']);

export class DiagnosticsProvider {
  private readonly diagnosticCollection: vscode.DiagnosticCollection;

  constructor(context: vscode.ExtensionContext) {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('kria');
    context.subscriptions.push(
      this.diagnosticCollection,
      vscode.workspace.onDidOpenTextDocument(document => this.validate(document)),
      vscode.workspace.onDidChangeTextDocument(event => this.validate(event.document)),
      vscode.workspace.onDidSaveTextDocument(document => this.validate(document)),
      vscode.workspace.onDidCloseTextDocument(document => this.diagnosticCollection.delete(document.uri))
    );
    vscode.workspace.textDocuments.forEach(document => this.validate(document));
  }

  private validate(document: vscode.TextDocument): void {
    if (document.languageId !== 'kria') return;

    const analysis = KriaParser.analyze(document);
    const diagnostics: vscode.Diagnostic[] = [];

    for (const issue of analysis.delimiters) {
      const isOpening = ['(', '[', '{'].includes(issue.token.value);
      const message = isOpening
        ? `Unclosed opening bracket '${issue.token.value}'. Expected '${issue.expected}'.`
        : issue.expected
          ? `Mismatched closing bracket '${issue.token.value}'. Expected '${issue.expected}'.`
          : `Unmatched closing bracket '${issue.token.value}'.`;
      diagnostics.push(this.createDiagnostic(document, issue.token, message));
    }

    for (let i = 0; i < analysis.tokens.length; i++) {
      const token = analysis.tokens[i];
      if (token.value !== 'input' || analysis.tokens[i + 1]?.value !== '<') continue;

      let end = i + 2;
      while (end < analysis.tokens.length &&
        analysis.tokens[end].value !== '>' &&
        analysis.tokens[end].kind !== 'newline') end++;
      if (analysis.tokens[end]?.value !== '>') continue;

      const typeTokens = analysis.tokens.slice(i + 2, end);
      const types = typeTokens.filter(item => item.kind === 'identifier').map(item => item.value);
      const separators = typeTokens.filter(item => item.value === '|').length;
      const valid = types.length > 0 &&
        types.every(type => validInputTypes.has(type)) &&
        separators === types.length - 1 &&
        typeTokens.every((item, index) => index % 2 === 0
          ? item.kind === 'identifier'
          : item.value === '|');

      if (!valid) {
        const endToken = analysis.tokens[end];
        const range = new vscode.Range(
          document.positionAt(token.start),
          document.positionAt(endToken.end)
        );
        const diagnostic = new vscode.Diagnostic(
          range,
          "Invalid input type selector. Use 'str', 'int', or 'float', optionally separated by '|'.",
          vscode.DiagnosticSeverity.Error
        );
        diagnostic.source = 'Kria parser';
        diagnostics.push(diagnostic);
      }
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  private createDiagnostic(
    document: vscode.TextDocument,
    token: KriaToken,
    message: string
  ): vscode.Diagnostic {
    const range = new vscode.Range(
      document.positionAt(token.start),
      document.positionAt(token.end)
    );
    const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
    diagnostic.source = 'Kria parser';
    return diagnostic;
  }

  public clear(uri: vscode.Uri): void {
    this.diagnosticCollection.delete(uri);
  }

  public clearAll(): void {
    this.diagnosticCollection.clear();
  }
}
