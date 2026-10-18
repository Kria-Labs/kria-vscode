import * as path from 'path';
import * as vscode from 'vscode';
import { FunctionDefinition, KriaParser } from './parser';

export interface ImportedFunction {
  moduleAlias: string;
  modulePath: string;
  functionName: string;
  memberRange: vscode.Range;
  document: vscode.TextDocument;
  definition: FunctionDefinition;
}

function samePath(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

export async function resolveImportedFunctionAt(
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<ImportedFunction | undefined> {
  const analysis = KriaParser.analyze(document);
  const offset = document.offsetAt(position);
  const memberIndex = analysis.tokens.findIndex(token =>
    token.kind === 'identifier' && offset >= token.start && offset <= token.end
  );
  if (memberIndex < 2 || analysis.tokens[memberIndex - 1].value !== '.') return undefined;

  const aliasToken = analysis.tokens[memberIndex - 2];
  if (aliasToken.kind !== 'identifier') return undefined;
  const imported = analysis.imports.find(item => item.name === aliasToken.value);
  if (!imported) return undefined;

  const modulePath = path.resolve(path.dirname(document.uri.fsPath), imported.path);
  try {
    const moduleDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(modulePath));
    const member = analysis.tokens[memberIndex];
    const definition = KriaParser.findFunctionDefinitions(moduleDocument)
      .find(func => func.name === member.value && func.isExported);
    if (!definition) return undefined;
    return {
      moduleAlias: imported.name,
      modulePath,
      functionName: member.value,
      memberRange: new vscode.Range(
        document.positionAt(member.start),
        document.positionAt(member.end)
      ),
      document: moduleDocument,
      definition
    };
  } catch (error) {
    console.warn(`Kria: Unable to open imported module '${modulePath}':`, error);
    return undefined;
  }
}

export async function findImportedMemberRanges(
  definitionDocument: vscode.TextDocument,
  functionName: string
): Promise<Array<{ document: vscode.TextDocument; range: vscode.Range }>> {
  const targetPath = path.resolve(definitionDocument.uri.fsPath);
  const files = await vscode.workspace.findFiles('**/*.krx', '**/{node_modules,.git}/**');
  const uris = new Map<string, vscode.Uri>(files.map(uri => [path.resolve(uri.fsPath), uri]));
  for (const document of vscode.workspace.textDocuments) {
    if (document.languageId === 'kria' && document.uri.scheme === 'file') {
      uris.set(path.resolve(document.uri.fsPath), document.uri);
    }
  }

  const results: Array<{ document: vscode.TextDocument; range: vscode.Range }> = [];
  for (const [filePath, uri] of uris) {
    if (samePath(filePath, targetPath)) continue;
    let document: vscode.TextDocument;
    try {
      document = await vscode.workspace.openTextDocument(uri);
    } catch (error) {
      console.warn(`Kria: Unable to read Kria file '${uri.fsPath}' while finding module references:`, error);
      continue;
    }

    const analysis = KriaParser.analyze(document);
    const aliases = new Set(analysis.imports
      .filter(item => samePath(path.resolve(path.dirname(filePath), item.path), targetPath))
      .map(item => item.name));
    if (!aliases.size) continue;

    for (let i = 2; i < analysis.tokens.length; i++) {
      const member = analysis.tokens[i];
      if (member.kind !== 'identifier' || member.value !== functionName ||
        analysis.tokens[i - 1].value !== '.' ||
        !aliases.has(analysis.tokens[i - 2].value)) continue;
      results.push({
        document,
        range: new vscode.Range(document.positionAt(member.start), document.positionAt(member.end))
      });
    }
  }
  return results;
}
