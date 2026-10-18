# Change Log

All notable changes to the "kria" extension will be documented in this file.

## [1.5.0] - Unreleased

### Fixed
- Completion, syntax highlighting, built-in navigation, and documentation for Kria logical operators and built-ins
- Import path completion now resolves from the current source file
- Input-type diagnostics now accept the language's `|`-separated input types
- Removed snippets for syntax not supported by Kria and added a union-input snippet
- Replaced regex-only symbol discovery with comment/string-aware source analysis for nested functions, declarations, and references
- Reworked formatting so it preserves string/comment text and range formatting only updates selected-line indentation
- Removed the unreliable line-based unreachable-code warning

### Changed
- Updated the README to match the current Kria language and the extension's implemented features
- Corrected the snippet count and merged the duplicate 1.4.0 changelog entries
- Added reference search, rename, signature help, imported export completions, and semantic highlighting
- Aligned extension metadata and badges at version 1.5.0
- Diagnostics remain local/static because the Kria CLI does not currently expose a compile-only command; invoking its file command would execute the program
- Added automated unit tests using Node.js's built-in test runner

## [1.4.0] - 2026-06-12

### Fixed
- Bracket linter fixed

### Added
- Diagnostics provider for real-time code analysis
  - Bracket matching validation
  - Invalid input type detection
  - Basic unreachable-code warning after return
- Document formatter with Shift+Alt+F support
  - Automatic indentation based on bracket depth
  - Consistent operator and keyword spacing
- Import path autocomplete for .krx files
- Enhanced auto-closing pairs for all bracket types including immutable arrays (#[]) and multi-line strings (""")
- Block comment support with /* */ syntax
- Extended snippet library with templates for supported Kria syntax
- elseif keyword support
- type() and wait() built-in functions

### Changed
- Extended completion provider trigger characters for import path detection
- Improved language configuration with better indentation patterns

## [1.3.0] - 2026-05-24

### Added
- IDE Features
  - Hover Information for functions, keywords, and variables
  - Go to Definition with Ctrl+Click
  - IntelliSense/Autocomplete with Ctrl+Space
- For-in object loop syntax highlighting
- Array element assignment pattern recognition
- Code snippets: forobj, expfn, imp
- TypeScript-based extension architecture

### Changed
- Upgraded VS Code engine requirement to ^1.75.0
- Improved syntax highlighting patterns
- Enhanced built-in functions database

## [1.1.0] - 2026-05-23

### Added
- Code snippets for common patterns
- Support for break and continue statements
- Support for for-in loops
- Array support (mutable [] and immutable #[])
- Array mutation built-ins: push(), pop(), and array property .length
- Object literals and property access
- Object property removal built-in: rmv()
- Enhanced syntax highlighting for arrays, objects, and input type arguments

### Changed
- Updated README with language documentation
- Expanded built-in functions support

## [1.0.0] - 2026-05-23
- Initial release