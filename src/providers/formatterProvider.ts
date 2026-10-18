import * as vscode from 'vscode';

type Delimiter = '{' | '[';

export class FormatterProvider implements vscode.DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions
  ): vscode.TextEdit[] {
    const formatted = this.format(document, options);
    if (formatted === document.getText()) return [];
    return [vscode.TextEdit.replace(
      new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)),
      formatted
    )];
  }

  format(document: vscode.TextDocument, options: vscode.FormattingOptions): string {
    const lines = document.getText().split(/\r\n|\r|\n/);
    const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
    const indentUnit = options.insertSpaces ? ' '.repeat(Math.max(1, options.tabSize || 2)) : '\t';
    const delimiters: Delimiter[] = [];
    let inBlockComment = false;
    let stringDelimiter: '"' | '"""' | undefined;

    return lines.map(line => {
      if (inBlockComment || stringDelimiter === '"""') {
        this.updateDelimitersAndLexicalState(line, delimiters, state => {
          inBlockComment = state.inBlockComment;
          stringDelimiter = state.stringDelimiter;
        }, inBlockComment, stringDelimiter);
        return line;
      }

      const trimmed = line.trim();
      if (!trimmed) return '';

      const isInsideComment = line.trimStart().startsWith('/*');
      const isInsideString = stringDelimiter !== undefined;
      if (isInsideComment || isInsideString) {
        this.updateDelimitersAndLexicalState(line, delimiters, state => {
          inBlockComment = state.inBlockComment;
          stringDelimiter = state.stringDelimiter;
        }, inBlockComment, stringDelimiter);
        return line;
      }

      let closeCount = 0;
      for (const char of trimmed) {
        if (char === '}' || char === ']') closeCount++;
        else break;
      }
      const indentation = Math.max(0, delimiters.length - closeCount);
      const formattedLine = indentUnit.repeat(indentation) + trimmed;
      this.updateDelimitersAndLexicalState(trimmed, delimiters, state => {
        inBlockComment = state.inBlockComment;
        stringDelimiter = state.stringDelimiter;
      }, inBlockComment, stringDelimiter);
      return formattedLine;
    }).join(eol);
  }

  formatRange(
    document: vscode.TextDocument,
    range: vscode.Range,
    options: vscode.FormattingOptions
  ): vscode.TextEdit[] {
    const formattedLines = this.format(document, options).split(/\r\n|\r|\n/);
    const edits: vscode.TextEdit[] = [];
    for (let lineNumber = range.start.line; lineNumber <= range.end.line; lineNumber++) {
      const line = document.lineAt(lineNumber);
      const original = line.text;
      const desired = formattedLines[lineNumber] ?? original;
      const originalContent = original.trimStart();
      const desiredContent = desired.trimStart();
      if (originalContent !== desiredContent) continue;

      const originalIndent = original.slice(0, original.length - originalContent.length);
      const desiredIndent = desired.slice(0, desired.length - desiredContent.length);
      if (originalIndent !== desiredIndent) {
        edits.push(vscode.TextEdit.replace(
          new vscode.Range(line.range.start, new vscode.Position(lineNumber, originalIndent.length)),
          desiredIndent
        ));
      }
    }
    return edits;
  }

  private updateDelimitersAndLexicalState(
    line: string,
    delimiters: Delimiter[],
    update: (state: { inBlockComment: boolean; stringDelimiter: '"' | '"""' | undefined }) => void,
    initialComment: boolean,
    initialString: '"' | '"""' | undefined
  ): void {
    let inBlockComment = initialComment;
    let stringDelimiter = initialString;

    for (let i = 0; i < line.length; i++) {
      if (inBlockComment) {
        if (line.startsWith('*/', i)) {
          inBlockComment = false;
          i++;
        }
        continue;
      }

      if (stringDelimiter) {
        if (line[i] === '\\') {
          i++;
        } else if (line.startsWith(stringDelimiter, i)) {
          i += stringDelimiter.length - 1;
          stringDelimiter = undefined;
        }
        continue;
      }

      if (line.startsWith('//', i)) break;
      if (line.startsWith('/*', i)) {
        inBlockComment = true;
        i++;
        continue;
      }
      if (line.startsWith('"""', i)) {
        stringDelimiter = '"""';
        i += 2;
        continue;
      }
      if (line[i] === '"') {
        stringDelimiter = '"';
        continue;
      }

      if (line[i] === '{' || line[i] === '[') delimiters.push(line[i] as Delimiter);
      else if ((line[i] === '}' || line[i] === ']') && delimiters.length > 0) delimiters.pop();
    }

    update({ inBlockComment, stringDelimiter });
  }
}

export class RangeFormattingProvider implements vscode.DocumentRangeFormattingEditProvider {
  private readonly formatter = new FormatterProvider();

  provideDocumentRangeFormattingEdits(
    document: vscode.TextDocument,
    range: vscode.Range,
    options: vscode.FormattingOptions
  ): vscode.TextEdit[] {
    return this.formatter.formatRange(document, range, options);
  }
}
