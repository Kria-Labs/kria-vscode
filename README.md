# Kria Programming Language - VS Code Extension

![Version](https://img.shields.io/badge/version-1.5.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![VS Code](https://img.shields.io/badge/VS%20Code-1.75.0+-blue)

VS Code language support for [Kria](https://github.com/Kria-Labs/kria-lang), a dynamically typed language with `.krx` source files. Includes syntax highlighting, lightweight diagnostics, formatting, navigation, completions, and snippets.

## Features

### IDE Features

- **Hover Information** - See built-in and keyword documentation, same-file symbol signatures/locations, and imported export signatures
- **Go to Definition** - Press `Ctrl+Click` on a same-file function, variable, or parameter, or an exported function accessed through an imported module alias
- **IntelliSense / Autocomplete** - Get smart code suggestions while typing
  - Type `prin` → Suggests `print()`
  - Type `arr.` → Suggests the array property `length`
  - Type `input<` or `input<int|` → Suggests `str`, `int`, `float`
  - Type `typ` → Suggests `type()`
  - Type `wait` → Suggests `wait()`
  - Type an import path → Suggests `.krx` files relative to the current file
  - Type `for` → Suggests array-loop and object-loop templates
  - Type `ifelse` → Suggests if-else templates
- **Code Diagnostics & Linting** - Real-time error detection
  - Mismatched and unclosed bracket detection
  - Invalid `input<...>` type-name detection, including union input types
  - These checks analyze source locally; they do not execute the file or invoke the Kria compiler
- **Code Formatter** - Basic document formatting
  - Press `Shift+Alt+F` to format entire document
  - Preserves string and comment contents; formats indentation without rewriting operators
  - Range formatting only changes indentation on selected lines
- **Import Path Autocomplete** - Suggests `.krx` modules and folders for relative imports
- **Find References and Rename** - Finds references and renames same-file symbols; exported functions are also traced through relative imports in the workspace
- **Signature Help** - Shows parameter lists while writing function and built-in calls, including exported module functions
- **Enhanced Bracket Autoclosing**
  - Auto-closes all bracket types: `{}`, `[]`, `()`, `#[]`
  - Auto-closes quotes: `"` and `"""` multi-line strings

### Syntax Highlighting
- **Keywords and logical operators** - `if`, `elseif`, `else`, `while`, `for`, `in`, `fn`, `set`, `return`, `break`, `continue`, `export`, `import`, `from`, `and`, `or`, `not`
- **Built-in Functions** - `print()`, `input()`, `push()`, `pop()`, `rmv()`, `type()`, `wait()`
- **Values** - Double-quoted and triple-double-quoted strings, integer and floating-point numbers, booleans, `null`, mutable arrays `[...]`, immutable arrays `#[...]`, and objects `{...}`
- **Input types** - `input<str>`, `input<int>`, `input<float>`, and unions such as `input<int|float|str>`; Kria is dynamically typed and these are not general variable or function type annotations
- **Operators** - `+`, `-`, `*`, `/`, `==`, `!=`, `>`, `<`, `>=`, `<=`, `=`, `and`, `or`, `not`
- **Array properties** - `.length`; array mutation uses `push(array, value)` and `pop(array)`, not method calls
- **Comments** - Single-line `// comment` and Multi-line `/* comment */`
- **Semantic highlighting** - Distinguishes declared and referenced functions, variables, parameters, imported modules, object properties, built-ins, and `input<...>` type selectors in addition to TextMate syntax coloring

### Language Support
- Auto-closing brackets: `{}`, `()`, `""`
- Automatic indentation
- Bracket matching
- File icon for `.krx` files
- Code snippets for common patterns

### Code Snippets
Quick templates for common code patterns (37 supported snippets):
- **Control Flow** - `fn`, `if`, `ifelse`, `ifelseif`, `while`, `for`, `forobj`, `guard`, `ifcond`
- **Variables** - `set`
- **Input/Output** - `inputstr`, `inputint`, `inputfloat`, `inputunion`, `print`
- **Arrays & Objects** - `arr`, `immarr`, `obj`, `push`, `pop`, `rmv`, `elem`, `setelement`, `iterarr`, `iterobj`
- **Functions and modules** - `fnested`, `anon`, `fnrec`, `expfn`, `imp`
- **Utilities** - `type`, `typeof`, `wait`, `delay`, `prop`, `str3`, `cmt`

## Installation

1. Search for "Kria Programming Language" in VS Code Extensions Marketplace
2. Click the "Install" button
3. Restart VS Code

## Quick Start

Create a new file with `.krx` extension:

```kria
// Hello World in Kria
print("Hello, Kria!")

// Variables
set name = "World"
set count = 42

// Functions
fn greet(greeting, target) {
    print(greeting)
    print(target)
}

greet("Hello", name)
```

For Kria's complete language overview, runtime behavior, and command-line setup, see the [language repository](https://github.com/Kria-Labs/kria-lang).

## File Extension

Save your Kria code with the `.krx` extension.

## Requirements

- VS Code 1.75.0 or newer

## Development and tests

Run `npm test` with Node.js 18 or newer to compile the extension and execute its automated unit tests with Node.js's built-in test runner. The tests cover source analysis and semantic token classification; they do not launch a VS Code extension host.

## License

MIT License - See LICENSE file in directory