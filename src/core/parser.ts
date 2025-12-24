import { parse } from '@babel/parser';
import type { ParseResult } from '@babel/parser';
import type { File } from '@babel/types';

/**
 * Babel parser plugins for TypeScript/JSX
 */
const BABEL_PLUGINS = [
  'jsx',
  'typescript',
  'classProperties',
  'classPrivateProperties',
  'decorators-legacy',
  'dynamicImport',
  'optionalChaining',
  'nullishCoalescingOperator',
] as const;

/**
 * Parse TypeScript/JavaScript file with JSX support
 */
export function parseCode(code: string, filename?: string): ParseResult<File> {
  return parse(code, {
    sourceType: 'module',
    sourceFilename: filename,
    plugins: [...BABEL_PLUGINS],
    errorRecovery: true,
  });
}

/**
 * Default patterns to ignore
 */
export const DEFAULT_IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/*.d.ts',
  '**/*.test.*',
  '**/*.spec.*',
  '**/dist/**',
  '**/build/**',
];

/**
 * Default file patterns to include
 */
export const DEFAULT_INCLUDE_PATTERN = 'src/**/*.{ts,tsx,js,jsx}';

/**
 * Function/method calls to skip (debug, errors)
 */
export const SKIP_CALLEE_NAMES = new Set([
  'console.log',
  'console.warn',
  'console.error',
  'console.info',
  'console.debug',
  'console.trace',
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ReferenceError',
]);

/**
 * JSX attributes to skip (technical)
 */
export const SKIP_JSX_ATTRIBUTES = new Set([
  'className',
  'class',
  'id',
  'name',
  'type',
  'href',
  'src',
  'alt',
  'data-testid',
  'data-cy',
  'data-test',
  'htmlFor',
  'key',
  'ref',
  'style',
  'target',
  'rel',
  'role',
  'tabIndex',
  'autoComplete',
  'inputMode',
  'pattern',
]);
