import * as vscode from 'vscode';
import { builtinNames, KriaParser, KriaSymbol } from '../utils/parser';
import { findImportedMemberRanges, resolveImportedFunctionAt } from '../utils/moduleResolver';

export class ReferenceProvider implements vscode.ReferenceProvider, vscode.RenameProvider {
  async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext
  ): Promise<vscode.Location[]> {
    const imported = await resolveImportedFunctionAt(document, position);
    if (imported) {
      const locations = await this.getSymbolLocations(imported.document, imported.definition.name, context.includeDeclaration);
      const importedRanges = await findImportedMemberRanges(imported.document, imported.functionName);
      return [
        ...locations,
        ...importedRanges.map(item => new vscode.Location(item.document.uri, item.range))
      ];
    }

    const symbol = KriaParser.findSymbolAt(document, position);
    if (!symbol) return [];
    const locations = await this.getSymbolLocations(document, symbol, context.includeDeclaration);
    if (symbol.kind !== 'function' || !symbol.isExported) return locations;

    const importedRanges = await findImportedMemberRanges(document, symbol.name);
    return [
      ...locations,
      ...importedRanges.map(item => new vscode.Location(item.document.uri, item.range))
    ];
  }

  async prepareRename(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Range | { range: vscode.Range; placeholder: string } | undefined> {
    const imported = await resolveImportedFunctionAt(document, position);
    if (imported) return { range: imported.memberRange, placeholder: imported.functionName };

    const symbol = KriaParser.findSymbolAt(document, position);
    if (!symbol) return undefined;
    const range = this.getTokenRange(document, position, symbol);
    return range ? { range, placeholder: symbol.name } : undefined;
  }

  async provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string
  ): Promise<vscode.WorkspaceEdit | undefined> {
    if (!/^[A-Za-z_]\w*$/.test(newName) || KriaParser.isKeyword(newName) || builtinNames.has(newName)) {
      throw new Error(`'${newName}' is not a valid Kria symbol name.`);
    }

    const imported = await resolveImportedFunctionAt(document, position);
    const targetDocument = imported?.document ?? document;
    const symbol: KriaSymbol | undefined = imported
      ? KriaParser.findFunctionDefinitions(targetDocument)
        .some(func => func.name === imported.functionName && func.isExported)
        ? KriaParser.findSymbolAt(
          targetDocument,
          new vscode.Position(imported.definition.line, imported.definition.character)
        )
        : undefined
      : KriaParser.findSymbolAt(document, position);
    if (!symbol) return undefined;

    const locations = await this.getSymbolLocations(targetDocument, symbol, true);
    const edit = new vscode.WorkspaceEdit();
    for (const location of locations) edit.replace(location.uri, location.range, newName);

    if (symbol.kind === 'function' && symbol.isExported) {
      const importedRanges = await findImportedMemberRanges(targetDocument, symbol.name);
      for (const item of importedRanges) edit.replace(item.document.uri, item.range, newName);
    }
    return edit;
  }

  private async getSymbolLocations(
    document: vscode.TextDocument,
    symbolOrName: KriaSymbol | string,
    includeDeclaration: boolean
  ): Promise<vscode.Location[]> {
    const symbol = typeof symbolOrName === 'string'
      ? KriaParser.analyze(document).symbols.find(item => item.name === symbolOrName && item.kind === 'function')
      : symbolOrName;
    if (!symbol) return [];

    const analysis = KriaParser.analyze(document);
    const ranges = [
      ...(includeDeclaration ? symbol.declarations : []),
      ...analysis.references.filter(reference => reference.symbol === symbol).map(reference => reference.range)
    ];
    const unique = new Map(ranges.map(range =>
      [`${range.start.line}:${range.start.character}`, range]
    ));
    return [...unique.values()].map(range => new vscode.Location(document.uri, range));
  }

  private getTokenRange(
    document: vscode.TextDocument,
    position: vscode.Position,
    symbol: KriaSymbol
  ): vscode.Range | undefined {
    const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_]\w*/);
    if (!wordRange || document.getText(wordRange) !== symbol.name) return undefined;
    return wordRange;
  }
}
