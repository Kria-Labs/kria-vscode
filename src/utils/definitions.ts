import * as vscode from 'vscode';

// Built-in Functions Documentation
export const BUILTIN_FUNCTIONS = {
  print: {
    signature: 'print(value: any): void',
    documentation: 'Print a value to the console output',
    kind: vscode.CompletionItemKind.Function,
    snippet: 'print(${1:value})'
  },
  input: {
    signature: 'input<str | int | float>(prompt: string): input value',
    documentation: 'Read a value from standard input. The type selector accepts str, int, float, or a | separated union such as input<int|float|str>. These selectors do not declare general variable types.',
    kind: vscode.CompletionItemKind.Function,
    snippet: 'input<${1:str}>(${2:"prompt"})'
  },
  push: {
    signature: 'push(array: Array, item: any): void',
    documentation: 'Add an item to the end of a mutable array',
    kind: vscode.CompletionItemKind.Function,
    snippet: 'push(${1:array}, ${2:item})'
  },
  pop: {
    signature: 'pop(array: Array): any',
    documentation: 'Remove and return the last item from a mutable array',
    kind: vscode.CompletionItemKind.Function,
    snippet: 'pop(${1:array})'
  },
  rmv: {
    signature: 'rmv(object.property): void',
    documentation: 'Remove a property from an object',
    kind: vscode.CompletionItemKind.Function,
    snippet: 'rmv(${1:object.property})'
  },
  type: {
    signature: 'type(value: any): string',
    documentation: 'Get the type of a value. Returns "number", "string", "boolean", "function", "array", "object", or "null"',
    kind: vscode.CompletionItemKind.Function,
    snippet: 'type(${1:value})'
  },
  wait: {
    signature: 'wait(milliseconds: number): void',
    documentation: 'Pause execution for the specified number of milliseconds',
    kind: vscode.CompletionItemKind.Function,
    snippet: 'wait(${1:1000})'
  }
};

// Keywords Documentation
export const KEYWORDS = {
  fn: {
    documentation: 'Define a function. Use: fn functionName(params) { ... }',
    kind: vscode.CompletionItemKind.Keyword
  },
  if: {
    documentation: 'Conditional statement. Use: if (condition) { ... }',
    kind: vscode.CompletionItemKind.Keyword
  },
  else: {
    documentation: 'Else clause for if statement. Use: else { ... }',
    kind: vscode.CompletionItemKind.Keyword
  },
  elseif: {
    documentation: 'Else if clause for conditional statements. Use: elseif (condition) { ... }',
    kind: vscode.CompletionItemKind.Keyword
  },
  while: {
    documentation: 'While loop. Use: while (condition) { ... }',
    kind: vscode.CompletionItemKind.Keyword
  },
  for: {
    documentation: 'For-in loop. Use: for item in array { ... } or for key, value in object { ... }',
    kind: vscode.CompletionItemKind.Keyword
  },
  set: {
    documentation: 'Variable declaration. Use: set variableName = value',
    kind: vscode.CompletionItemKind.Keyword
  },
  return: {
    documentation: 'Return a value from a function. Use: return value',
    kind: vscode.CompletionItemKind.Keyword
  },
  break: {
    documentation: 'Break out of a loop',
    kind: vscode.CompletionItemKind.Keyword
  },
  continue: {
    documentation: 'Skip to the next iteration of a loop',
    kind: vscode.CompletionItemKind.Keyword
  },
  in: {
    documentation: 'Separate the loop variable(s) from the iterable in a for-in loop',
    kind: vscode.CompletionItemKind.Keyword
  },
  and: {
    documentation: 'Logical AND operator; both operands must be booleans',
    kind: vscode.CompletionItemKind.Operator
  },
  or: {
    documentation: 'Logical OR operator; both operands must be booleans',
    kind: vscode.CompletionItemKind.Operator
  },
  not: {
    documentation: 'Logical NOT operator; its operand must be a boolean',
    kind: vscode.CompletionItemKind.Operator
  },
  export: {
    documentation: 'Export a function for use by modules that import this file',
    kind: vscode.CompletionItemKind.Keyword
  },
  import: {
    documentation: 'Import a module. Use: import name from "./path.krx"',
    kind: vscode.CompletionItemKind.Keyword
  },
  from: {
    documentation: 'Separate the imported module alias from its relative .krx path',
    kind: vscode.CompletionItemKind.Keyword
  },
  true: {
    documentation: 'Boolean true value',
    kind: vscode.CompletionItemKind.Constant
  },
  false: {
    documentation: 'Boolean false value',
    kind: vscode.CompletionItemKind.Constant
  },
  null: {
    documentation: 'Null value',
    kind: vscode.CompletionItemKind.Constant
  }
};

// Array properties
export const ARRAY_PROPERTIES = [
  {
    name: 'length',
    documentation: 'Get the length of an array',
    snippet: 'length',
    kind: vscode.CompletionItemKind.Property
  }
];

// Input type selectors
export const INPUT_TYPES = [
  {
    name: 'str',
    documentation: 'Read input as a string',
    kind: vscode.CompletionItemKind.TypeParameter
  },
  {
    name: 'int',
    documentation: 'Read input as an integer',
    kind: vscode.CompletionItemKind.TypeParameter
  },
  {
    name: 'float',
    documentation: 'Read input as a floating-point number',
    kind: vscode.CompletionItemKind.TypeParameter
  }
];
