/**
 * @fileoverview Sort command - sort translation keys alphabetically.
 * Ensures consistent key ordering across all language files.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { TranslationJson } from '../types/index.js';
import { sortKeys, countKeys } from '../core/json-utils.js';
import { colors, output } from '../core/output.js';

const DEFAULT_LOCALES_PATH = 'public/locales';

/**
 * Result of sort operation
 */
export interface SortResult {
  /** Files that were sorted */
  sortedFiles: string[];
  /** Files that were already sorted */
  alreadySorted: string[];
  /** Total keys processed */
  totalKeys: number;
}

/**
 * Options for sort command
 */
export interface SortOptions {
  /** Root directory */
  root?: string;
  /** Path to locales directory */
  localesPath?: string;
  /** Languages to sort */
  languages?: string[];
  /** Check only - don't modify files */
  check?: boolean;
  /** Silent mode */
  silent?: boolean;
}

/**
 * Check if object is already sorted
 */
function isSorted(obj: TranslationJson): boolean {
  const keys = Object.keys(obj);
  const sortedKeys = [...keys].sort();

  for (let i = 0; i < keys.length; i++) {
    if (keys[i] !== sortedKeys[i]) {
      return false;
    }

    const value = obj[keys[i]];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!isSorted(value)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Sort translation keys alphabetically in all locale files.
 * Ensures consistent ordering for easier diffs and reviews.
 *
 * @param options - Sort options
 * @returns Sort result
 *
 * @example
 * ```typescript
 * // Check if files need sorting
 * const check = await sort({ check: true });
 * if (check.sortedFiles.length > 0) {
 *   console.log('Files need sorting');
 * }
 *
 * // Actually sort
 * const result = await sort();
 * console.log(`Sorted ${result.sortedFiles.length} files`);
 * ```
 */
export async function sort(options: SortOptions = {}): Promise<SortResult> {
  const root = options.root || process.cwd();
  const localesPath = options.localesPath || DEFAULT_LOCALES_PATH;
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
      return { sortedFiles: [], alreadySorted: [], totalKeys: 0 };
    }
  }

  if (!options.silent) {
    output.header(options.check ? 'Check Sort Order' : 'Sort Translation Keys');
    output.keyValue('Languages', languages.join(', '));
    output.newline();
  }

  const sortedFiles: string[] = [];
  const alreadySorted: string[] = [];
  let totalKeys = 0;

  for (const lang of languages) {
    const filePath = path.join(localesDir, lang, 'translation.json');

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const json = JSON.parse(content) as TranslationJson;

      totalKeys += countKeys(json);

      if (isSorted(json)) {
        alreadySorted.push(filePath);
        if (!options.silent) {
          console.log(`${colors.lang(lang.toUpperCase())}: ${colors.success('already sorted')} ${colors.symbols.success}`);
        }
      } else {
        sortedFiles.push(filePath);

        if (options.check) {
          if (!options.silent) {
            console.log(`${colors.lang(lang.toUpperCase())}: ${colors.warning('needs sorting')} ${colors.symbols.warning}`);
          }
        } else {
          const sorted = sortKeys(json);
          fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
          if (!options.silent) {
            console.log(`${colors.lang(lang.toUpperCase())}: ${colors.success('sorted')} ${colors.symbols.success}`);
          }
        }
      }
    } catch (error) {
      if (!options.silent) {
        output.warn(`Could not process ${lang}: ${(error as Error).message}`);
      }
    }
  }

  // Summary
  if (!options.silent) {
    output.newline();
    output.separator();
    output.keyValue('Total keys', totalKeys);

    if (options.check) {
      if (sortedFiles.length > 0) {
        output.warn(`${sortedFiles.length} file(s) need sorting`);
      } else {
        output.success('All files are properly sorted');
      }
    } else {
      if (sortedFiles.length > 0) {
        output.success(`Sorted ${sortedFiles.length} file(s)`);
      } else {
        output.success('All files were already sorted');
      }
    }
  }

  return {
    sortedFiles,
    alreadySorted,
    totalKeys,
  };
}
