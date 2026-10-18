import * as vscode from 'vscode';
import { HoverProvider } from './providers/hoverProvider';
import { DefinitionProvider } from './providers/definitionProvider';
import { CompletionProvider } from './providers/completionProvider';
import { DiagnosticsProvider } from './providers/diagnosticsProvider';
import { FormatterProvider, RangeFormattingProvider } from './providers/formatterProvider';
import { ReferenceProvider } from './providers/referenceProvider';
import { SignatureHelpProvider } from './providers/signatureHelpProvider';
import {
  KRIA_SEMANTIC_TOKEN_MODIFIERS,
  KRIA_SEMANTIC_TOKEN_TYPES,
  SemanticTokensProvider
} from './providers/semanticTokensProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('Kria extension is now active!');

  // Register Hover Provider
  const hoverProvider = vscode.languages.registerHoverProvider(
    'kria',
    new HoverProvider()
  );
  context.subscriptions.push(hoverProvider);

  // Register Definition Provider
  const definitionProvider = vscode.languages.registerDefinitionProvider(
    'kria',
    new DefinitionProvider()
  );
  context.subscriptions.push(definitionProvider);

  const referenceProvider = new ReferenceProvider();
  context.subscriptions.push(
    vscode.languages.registerReferenceProvider('kria', referenceProvider),
    vscode.languages.registerRenameProvider('kria', referenceProvider)
  );

  // Register Completion Provider
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    'kria',
    new CompletionProvider(),
    '.', '(', '<', ',', '"', '/', "'" // Trigger characters including import paths
  );
  context.subscriptions.push(completionProvider);

  context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(
    'kria',
    new SignatureHelpProvider(),
    { triggerCharacters: ['(', ','], retriggerCharacters: [','] }
  ));

  const semanticTokensLegend = new vscode.SemanticTokensLegend(
    KRIA_SEMANTIC_TOKEN_TYPES,
    KRIA_SEMANTIC_TOKEN_MODIFIERS
  );
  context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider(
    'kria',
    new SemanticTokensProvider(),
    semanticTokensLegend
  ));

  // Register Diagnostics Provider
  const diagnosticsProvider = new DiagnosticsProvider(context);

  // Register Formatter Provider
  const formatterProvider = vscode.languages.registerDocumentFormattingEditProvider(
    'kria',
    new FormatterProvider()
  );
  context.subscriptions.push(formatterProvider);

  // Register Range Formatter Provider
  const rangeFormatterProvider = vscode.languages.registerDocumentRangeFormattingEditProvider(
    'kria',
    new RangeFormattingProvider()
  );
  context.subscriptions.push(rangeFormatterProvider);

  console.log('Kria IDE features loaded:');
  console.log('  ✓ Hover Information');
  console.log('  ✓ Go to Definition (Ctrl+Click)');
  console.log('  ✓ Completion / IntelliSense');
  console.log('  ✓ Code Diagnostics & Linting');
  console.log('  ✓ Code Formatter (Shift+Alt+F)');
  console.log('  ✓ Import Path Autocomplete');
  console.log('  ✓ Find References and Rename');
  console.log('  ✓ Signature Help');
  console.log('  ✓ Semantic Highlighting');
}

export function deactivate() {}
