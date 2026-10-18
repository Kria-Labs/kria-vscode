import * as vscode from 'vscode';
import * as path from 'path';
import {
  BUILTIN_FUNCTIONS,
  KEYWORDS,
  ARRAY_PROPERTIES,
  INPUT_TYPES
} from '../utils/definitions';
import { KriaParser } from '../utils/parser';

export class CompletionProvider implements vscode.CompletionItemProvider {
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[]> {
    const line = KriaParser.getLineAtPosition(document, position);
    const beforeCursor = line.substring(0, position.character);
    const items: vscode.CompletionItem[] = [];

    const importedMember = beforeCursor.match(/\b([A-Za-z_]\w*)\s*\.\s*([A-Za-z_]\w*)?$/);
    if (importedMember) {
      const imported = KriaParser.findImportStatement(document, importedMember[1]);
      if (imported) {
        return this.getImportedMemberCompletions(
          document,
          position,
          importedMember[1],
          imported.path,
          importedMember[2] ?? ''
        );
      }
    }

    // Context: Import paths (inside import statement)
    if (beforeCursor.includes('import') && (beforeCursor.includes('from') || beforeCursor.includes('"') || beforeCursor.includes("'"))) {
      return this.getImportPathCompletions(document, beforeCursor);
    }

    // Context: Array properties (after an expression and dot)
    if (beforeCursor.match(/\w+\.$/)) {
      return this.getArrayPropertyCompletions();
    }

    // Context: input type arguments, including the next type in a union
    if (/\binput\s*<[^>]*$/i.test(beforeCursor)) {
      return this.getInputTypeCompletions();
    }

    // Context: General completions
    items.push(...this.getKeywordCompletions());
    items.push(...this.getBuiltInFunctionCompletions());
    items.push(...this.getUserDefinedCompletions(document, position));

    return items;
  }

  /**
   * Get keyword completion items
   */
  private getKeywordCompletions(): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    // Standard keywords with snippets
    const snippets = {
      fn: 'fn ${1:functionName}(${2:parameters}) {\n\t$3\n\treturn $4\n}',
      if: 'if (${1:condition}) {\n\t$2\n}',
      while: 'while (${1:condition}) {\n\t$2\n}',
      for: 'for ${1:item} in ${2:array} {\n\t$3\n}',
      forobj: 'for ${1:key}, ${2:value} in ${3:object} {\n\t$4\n}',
      set: 'set ${1:variableName} = ${2:value}',
      ifelse: 'if (${1:condition}) {\n\t$2\n} else {\n\t$3\n}'
    };

    for (const [word, snippet] of Object.entries(snippets)) {
      const item = new vscode.CompletionItem(word, vscode.CompletionItemKind.Snippet);
      item.insertText = new vscode.SnippetString(snippet);
      
      if (word in KEYWORDS) {
        const keyword = KEYWORDS[word as keyof typeof KEYWORDS];
        item.documentation = keyword.documentation;
      }
      
      items.push(item);
    }

    // Other keywords without snippets
    for (const [word, keyword] of Object.entries(KEYWORDS)) {
      if (!snippets.hasOwnProperty(word)) {
        const item = new vscode.CompletionItem(word, keyword.kind);
        item.documentation = keyword.documentation;
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Get built-in function completion items
   */
  private getBuiltInFunctionCompletions(): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    for (const [name, func] of Object.entries(BUILTIN_FUNCTIONS)) {
      const item = new vscode.CompletionItem(name, func.kind);
      item.insertText = new vscode.SnippetString(func.snippet);
      item.documentation = func.documentation;
      item.detail = func.signature;
      items.push(item);
    }

    return items;
  }

  /**
   * Get array property completion items
   */
  private getArrayPropertyCompletions(): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    for (const property of ARRAY_PROPERTIES) {
      const item = new vscode.CompletionItem(property.name, property.kind);
      item.insertText = new vscode.SnippetString(property.snippet);
      item.documentation = property.documentation;
      items.push(item);
    }

    return items;
  }

  /**
   * Get valid input type completion items
   */
  private getInputTypeCompletions(): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    for (const type of INPUT_TYPES) {
      const item = new vscode.CompletionItem(type.name, type.kind);
      item.documentation = type.documentation;
      items.push(item);
    }

    return items;
  }

  private async getImportedMemberCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    alias: string,
    importPath: string,
    memberPrefix: string
  ): Promise<vscode.CompletionItem[]> {
    const resolvedPath = KriaParser.resolveImportPath(document.uri.fsPath, importPath);
    let moduleDocument: vscode.TextDocument;
    try {
      moduleDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(resolvedPath));
    } catch (error) {
      console.warn(`Kria: Unable to open imported module '${resolvedPath}':`, error);
      return [];
    }
    const range = new vscode.Range(
      new vscode.Position(position.line, position.character - memberPrefix.length),
      position
    );

    return KriaParser.findFunctionDefinitions(moduleDocument)
      .filter(func => func.isExported)
      .map(func => {
        const item = new vscode.CompletionItem(func.name, vscode.CompletionItemKind.Function);
        item.detail = `fn ${func.name}(${func.params.join(', ')})`;
        item.documentation = `Exported by ${alias}`;
        item.range = range;
        item.insertText = new vscode.SnippetString(
          func.params.length
            ? `${func.name}(\${1:${func.params[0]}})`
            : `${func.name}()`
        );
        return item;
      });
  }

  /**
   * Get import path completion items for .krx files
   */
  private async getImportPathCompletions(document: vscode.TextDocument, beforeCursor: string): Promise<vscode.CompletionItem[]> {
    const items: vscode.CompletionItem[] = [];

    // Extract current path from import statement
    const pathMatch = beforeCursor.match(/from\s+["']([^"']*)$/);
    if (!pathMatch) {
      // Show initial path suggestions
      const item = new vscode.CompletionItem('./', vscode.CompletionItemKind.Folder);
      item.detail = 'Current directory';
      items.push(item);

      const parentItem = new vscode.CompletionItem('../', vscode.CompletionItemKind.Folder);
      parentItem.detail = 'Parent directory';
      items.push(parentItem);

      return items;
    }

    const currentPath = pathMatch[1];
    const baseDir = path.dirname(document.uri.fsPath);
    const fullPath = path.resolve(baseDir, currentPath);
    const dirPath = currentPath.endsWith('/') || currentPath.endsWith('\\')
      ? fullPath
      : path.dirname(fullPath);
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
    } catch (error) {
      if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') return items;
      console.warn(`Kria: Unable to list import directory '${dirPath}':`, error);
      return items;
    }

    for (const [file, type] of entries) {
      if (type === vscode.FileType.Directory) {
        items.push(new vscode.CompletionItem(`${file}/`, vscode.CompletionItemKind.Folder));
      } else if (file.endsWith('.krx')) {
        const item = new vscode.CompletionItem(file, vscode.CompletionItemKind.File);
        item.detail = 'Kria module';
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Get user-defined symbols (functions, variables) for completion
   */
  private getUserDefinedCompletions(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];
    const analysis = KriaParser.analyze(document);

    // User-defined functions
    const functions = KriaParser.findFunctionDefinitions(document);
    for (const func of functions) {
      const item = new vscode.CompletionItem(func.name, vscode.CompletionItemKind.Function);
      item.detail = `fn ${func.name}(${func.params.join(', ')})`;
      item.documentation = `User-defined function${func.isExported ? ' (exported)' : ''}`;
      items.push(item);
    }

    // User-defined variables
    const variables = KriaParser.findVariableDeclarations(document);
    for (const variable of variables) {
      const symbol = analysis.symbols.find(item => item.name === variable.name && item.kind === 'variable');
      const item = new vscode.CompletionItem(
        variable.name,
        symbol?.isCallable ? vscode.CompletionItemKind.Function : vscode.CompletionItemKind.Variable
      );
      if (symbol?.isCallable) {
        item.detail = `fn ${variable.name}(${symbol.params.join(', ')})`;
        item.documentation = 'User-defined anonymous function';
      } else {
        item.documentation = 'User-defined variable';
      }
      items.push(item);
    }

    for (const parameter of analysis.symbols.filter(symbol =>
      symbol.kind === 'parameter' &&
      position.isAfterOrEqual(symbol.scope.start) &&
      position.isBeforeOrEqual(symbol.scope.end)
    )) {
      const item = new vscode.CompletionItem(parameter.name, vscode.CompletionItemKind.Variable);
      item.documentation = 'Function parameter';
      items.push(item);
    }

    return items;
  }
}
