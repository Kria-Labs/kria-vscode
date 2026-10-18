import * as vscode from 'vscode';
import { KriaParser } from '../utils/parser';
import { resolveImportedFunctionAt } from '../utils/moduleResolver';

export class DefinitionProvider implements vscode.DefinitionProvider {
  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Definition | undefined> {
    const imported = await resolveImportedFunctionAt(document, position);
    if (imported) {
      return new vscode.Location(
        imported.document.uri,
        new vscode.Position(imported.definition.line, imported.definition.character)
      );
    }

    const symbol = KriaParser.findSymbolAt(document, position);
    return symbol
      ? new vscode.Location(document.uri, symbol.declaration.start)
      : undefined;
  }
}
