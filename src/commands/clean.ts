/**
 * @fileoverview Clean command - remove unused translation keys.
 * Scans code for t() calls and removes keys not used anywhere.
 */

import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type { CallExpression } from '@babel/types';
import type { TranslationJson } from '../types/index.js';
import { parseCode, DEFAULT_IGNORE_PATTERNS, DEFAULT_INCLUDE_PATTERN } from '../core/parser.js';
import { flattenKeys, sortKeys } from '../core/json-utils.js';
import { colors, output, createProgressBar, Table } from '../core/output.js';

const traverse = (_traverse as unknown as { default: typeof _traverse }).default || _traverse;

const DEFAULT_LOCALES_PATH = 'public/locales';

/**
 * Result of clean operation
 */
export interface CleanResult {
  /** Number of keys removed */
  removedCount: number;
  /** Keys that were removed */
  removedKeys: string[];
  /** Keys that are still used */
  usedCount: number;
  /** Files that were modified */
  modifiedFiles: string[];
}

/**
 * Options for clean command
 */
export interface CleanOptions {
  /** Root directory */
  root?: string;
  /** Path to locales directory */
  localesPath?: string;
  /** Glob pattern for source files */
  include?: string;
  /** Languages to clean */
  languages?: string[];
  /** Dry run - don't actually remove */
  dryRun?: boolean;
  /** Silent mode */
  silent?: boolean;
}

/**
 * Find all translation keys used in code
 */
async function findUsedKeys(
  root: string,
  include: string
): Promise<Set<string>> {
  const usedKeys = new Set<string>();

  const files = await fg(include, {
    cwd: root,
    absolute: true,
    ignore: DEFAULT_IGNORE_PATTERNS,
  });

  for (const file of files) {
    try {
      const code = fs.readFileSync(file, 'utf8');
      const relPath = path.relative(root, file);
      const ast = parseCode(code, relPath);

      traverse(ast, {
        CallExpression(p: NodePath<CallExpression>) {
          const callee = p.node.callee;

          // t('key') or i18n.t('key')
          const isTCall =
            (callee.type === 'Identifier' && callee.name === 't') ||
            (callee.type === 'MemberExpression' &&
              callee.property.type === 'Identifier' &&
              callee.property.name === 't');

          if (!isTCall) return;

          const firstArg = p.node.arguments[0];
          if (!firstArg) return;

          // String literal
          if (firstArg.type === 'StringLiteral') {
            usedKeys.add(firstArg.value);
          }
          // Template literal without expressions
          else if (firstArg.type === 'TemplateLiteral' && firstArg.expressions.length === 0) {
            usedKeys.add(firstArg.quasis[0]?.value?.raw || '');
          }
        },
      });
    } catch {
      // Skip files that can't be parsed
    }
  }

  return usedKeys;
}

/**
 * Remove unused keys from translation object
 */
function removeUnusedKeys(
  obj: TranslationJson,
  usedKeys: Set<string>,
  prefix = ''
): { cleaned: TranslationJson; removed: string[] } {
  const cleaned: TranslationJson = {};
  const removed: string[] = [];

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively clean nested objects
      const nested = removeUnusedKeys(value, usedKeys, fullKey);

      // Only keep if there are remaining keys
      if (Object.keys(nested.cleaned).length > 0) {
        cleaned[key] = nested.cleaned;
      }
      removed.push(...nested.removed);
    } else {
      // Check if this key is used
      if (usedKeys.has(fullKey)) {
        cleaned[key] = value;
      } else {
        removed.push(fullKey);
      }
    }
  }

  return { cleaned, removed };
}

/**
 * Remove unused translation keys from locale files.
 * Scans source code for t() calls and removes keys not found.
 *
 * @param options - Clean options
 * @returns Clean result with removed keys
 *
 * @example
 * ```typescript
 * // Dry run first
 * const preview = await clean({ dryRun: true });
 * console.log(`Would remove ${preview.removedCount} keys`);
 *
 * // Actually clean
 * const result = await clean();
 * console.log(`Removed ${result.removedCount} keys`);
 * ```
 */
export async function clean(options: CleanOptions = {}): Promise<CleanResult> {
  const root = options.root || process.cwd();
  const localesPath = options.localesPath || DEFAULT_LOCALES_PATH;
  const include = options.include || DEFAULT_INCLUDE_PATTERN;
  const localesDir = path.join(root, localesPath);

  // Determine languages
  let languages = options.languages || [];
  if (languages.length === 0) {
    try {
      const dirs = fs.readdirSync(localesDir, { withFileTypes: true });
      languages = dirs.filter(d => d.isDirectory()).map(d => d.name);
    } catch {
      if (!options.silent) {
        output.error(`Could not read locales directory: ${localesDir}`);
      }
      return { removedCount: 0, removedKeys: [], usedCount: 0, modifiedFiles: [] };
    }
  }

  if (!options.silent) {
    output.header(options.dryRun ? 'Clean (Dry Run)' : 'Clean Unused Keys');
    output.keyValue('Pattern', include);
    output.keyValue('Languages', languages.join(', '));
    output.newline();
  }

  // Find all used keys in code
  if (!options.silent) {
    output.info('Scanning source files...');
  }

  const usedKeys = await findUsedKeys(root, include);

  if (!options.silent) {
    output.keyValue('Keys used in code', usedKeys.size);
    output.newline();
  }

  const allRemoved: string[] = [];
  const modifiedFiles: string[] = [];

  // Process each language
  for (const lang of languages) {
    const filePath = path.join(localesDir, lang, 'translation.json');

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const json = JSON.parse(content) as TranslationJson;

      const before = flattenKeys(json).size;
      const { cleaned, removed } = removeUnusedKeys(json, usedKeys);
      const after = flattenKeys(cleaned).size;

      if (removed.length > 0) {
        if (!options.silent) {
          console.log(`${colors.lang(lang.toUpperCase())}: ${colors.warning(`-${removed.length}`)} keys`);
        }

        // Only track unique removed keys (they're the same across languages)
        for (const key of removed) {
          if (!allRemoved.includes(key)) {
            allRemoved.push(key);
          }
        }

        if (!options.dryRun) {
          const sorted = sortKeys(cleaned);
          fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
          modifiedFiles.push(filePath);
        }
      } else {
        if (!options.silent) {
          console.log(`${colors.lang(lang.toUpperCase())}: ${colors.success('no unused keys')}`);
        }
      }
    } catch (error) {
      if (!options.silent) {
        output.warn(`Could not process ${lang}: ${(error as Error).message}`);
      }
    }
  }

  // Show removed keys
  if (!options.silent && allRemoved.length > 0) {
    output.newline();
    output.section('Removed Keys');

    for (const key of allRemoved.slice(0, 30)) {
      console.log(`  ${colors.dim('-')} ${colors.key(key)}`);
    }

    if (allRemoved.length > 30) {
      output.dim(`  ... and ${allRemoved.length - 30} more`);
    }
  }

  // Summary
  if (!options.silent) {
    output.newline();
    output.separator();

    if (options.dryRun) {
      output.info(`Would remove ${colors.bold(String(allRemoved.length))} unused keys`);
      output.dim('Run without --dry-run to actually remove them');
    } else if (allRemoved.length > 0) {
      output.success(`Removed ${colors.bold(String(allRemoved.length))} unused keys`);
    } else {
      output.success('No unused keys found');
    }
  }

  return {
    removedCount: allRemoved.length,
    removedKeys: allRemoved,
    usedCount: usedKeys.size,
    modifiedFiles,
  };
}
