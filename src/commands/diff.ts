/**
 * @fileoverview Diff command - show differences between language files.
 * Compares translation coverage and missing keys between languages.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { TranslationJson } from '../types/index.js';
import { flattenKeys } from '../core/json-utils.js';
import { colors, output, Table, formatPercent } from '../core/output.js';

const DEFAULT_LOCALES_PATH = 'public/locales';

/**
 * Diff result for a language pair
 */
export interface DiffResult {
  /** Source language code */
  source: string;
  /** Target language code */
  target: string;
  /** Keys only in source */
  onlyInSource: string[];
  /** Keys only in target */
  onlyInTarget: string[];
  /** Keys in both but empty in target */
  emptyInTarget: string[];
  /** Keys in both with values */
  translated: number;
  /** Total keys in source */
  totalSource: number;
  /** Total keys in target */
  totalTarget: number;
}

/**
 * Options for diff command
 */
export interface DiffOptions {
  /** Root directory */
  root?: string;
  /** Path to locales directory */
  localesPath?: string;
  /** Source language to compare from */
  source?: string;
  /** Target language(s) to compare to */
  target?: string[];
  /** Show detailed key list */
  detailed?: boolean;
  /** Silent mode */
  silent?: boolean;
}

/**
 * Load and flatten translation file
 */
function loadTranslations(filePath: string): Map<string, string> | null {
  try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8')) as TranslationJson;
    return flattenKeys(json);
  } catch {
    return null;
  }
}

/**
 * Compare two language files and return differences
 */
function compareLangs(
  sourceMap: Map<string, string>,
  targetMap: Map<string, string>,
  sourceLang: string,
  targetLang: string
): DiffResult {
  const onlyInSource: string[] = [];
  const onlyInTarget: string[] = [];
  const emptyInTarget: string[] = [];
  let translated = 0;

  // Check source keys
  for (const [key, value] of sourceMap) {
    if (!targetMap.has(key)) {
      onlyInSource.push(key);
    } else {
      const targetValue = targetMap.get(key) || '';
      if (targetValue === '') {
        emptyInTarget.push(key);
      } else {
        translated++;
      }
    }
  }

  // Check target-only keys
  for (const key of targetMap.keys()) {
    if (!sourceMap.has(key)) {
      onlyInTarget.push(key);
    }
  }

  return {
    source: sourceLang,
    target: targetLang,
    onlyInSource,
    onlyInTarget,
    emptyInTarget,
    translated,
    totalSource: sourceMap.size,
    totalTarget: targetMap.size,
  };
}

/**
 * Show differences between language files.
 * Compares source language with target languages and shows:
 * - Keys missing in target
 * - Keys only in target (extra)
 * - Empty translations in target
 *
 * @param options - Diff options
 * @returns Array of diff results
 *
 * @example
 * ```typescript
 * const results = await diff({
 *   source: 'ru',
 *   target: ['en', 'kk'],
 *   detailed: true,
 * });
 * ```
 */
export async function diff(options: DiffOptions = {}): Promise<DiffResult[]> {
  const root = options.root || process.cwd();
  const localesPath = options.localesPath || DEFAULT_LOCALES_PATH;
  const sourceLang = options.source || 'ru';
  const localesDir = path.join(root, localesPath);

  // Determine target languages
  let targetLangs = options.target || [];
  if (targetLangs.length === 0) {
    // Auto-detect from directory
    try {
      const dirs = fs.readdirSync(localesDir, { withFileTypes: true });
      targetLangs = dirs
        .filter(d => d.isDirectory() && d.name !== sourceLang)
        .map(d => d.name);
    } catch {
      if (!options.silent) {
        output.error(`Could not read locales directory: ${localesDir}`);
      }
      return [];
    }
  }

  if (!options.silent) {
    output.header(`Translation Diff: ${colors.lang(sourceLang)} → ${colors.lang(targetLangs.join(', '))}`);
  }

  // Load source translations
  const sourceFile = path.join(localesDir, sourceLang, 'translation.json');
  const sourceMap = loadTranslations(sourceFile);

  if (!sourceMap) {
    if (!options.silent) {
      output.error(`Could not load source file: ${sourceFile}`);
    }
    return [];
  }

  if (!options.silent) {
    output.keyValue('Source keys', sourceMap.size);
    output.newline();
  }

  const results: DiffResult[] = [];

  for (const targetLang of targetLangs) {
    const targetFile = path.join(localesDir, targetLang, 'translation.json');
    const targetMap = loadTranslations(targetFile);

    if (!targetMap) {
      if (!options.silent) {
        output.warn(`Could not load: ${targetFile}`);
      }
      continue;
    }

    const result = compareLangs(sourceMap, targetMap, sourceLang, targetLang);
    results.push(result);

    if (!options.silent) {
      // Summary for this language
      output.section(`${colors.lang(targetLang.toUpperCase())}`);

      const table = new Table(['Metric', 'Count', 'Status']);

      const missingCount = result.onlyInSource.length;
      const emptyCount = result.emptyInTarget.length;
      const extraCount = result.onlyInTarget.length;
      const coverage = formatPercent(result.translated, result.totalSource);

      table.addRow([
        'Translated',
        result.translated,
        colors.success(`${result.translated}/${result.totalSource}`),
      ]);
      table.addRow([
        'Coverage',
        coverage,
        coverage,
      ]);
      table.addRow([
        'Missing keys',
        missingCount,
        missingCount > 0 ? colors.error(String(missingCount)) : colors.success('0'),
      ]);
      table.addRow([
        'Empty values',
        emptyCount,
        emptyCount > 0 ? colors.warning(String(emptyCount)) : colors.success('0'),
      ]);
      table.addRow([
        'Extra keys',
        extraCount,
        extraCount > 0 ? colors.dim(String(extraCount)) : colors.dim('0'),
      ]);

      table.print();

      // Detailed key list
      if (options.detailed) {
        if (result.onlyInSource.length > 0) {
          output.newline();
          console.log(colors.error('Missing keys:'));
          for (const key of result.onlyInSource.slice(0, 20)) {
            console.log(`  ${colors.dim('-')} ${colors.key(key)}`);
          }
          if (result.onlyInSource.length > 20) {
            console.log(colors.dim(`  ... and ${result.onlyInSource.length - 20} more`));
          }
        }

        if (result.emptyInTarget.length > 0) {
          output.newline();
          console.log(colors.warning('Empty translations:'));
          for (const key of result.emptyInTarget.slice(0, 20)) {
            const sourceValue = sourceMap.get(key) || '';
            const shortValue = sourceValue.length > 40 ? sourceValue.substring(0, 40) + '...' : sourceValue;
            console.log(`  ${colors.dim('-')} ${colors.key(key)}: ${colors.dim(`"${shortValue}"`)}`);
          }
          if (result.emptyInTarget.length > 20) {
            console.log(colors.dim(`  ... and ${result.emptyInTarget.length - 20} more`));
          }
        }

        if (result.onlyInTarget.length > 0) {
          output.newline();
          console.log(colors.dim('Extra keys (only in target):'));
          for (const key of result.onlyInTarget.slice(0, 10)) {
            console.log(`  ${colors.dim('-')} ${colors.dim(key)}`);
          }
          if (result.onlyInTarget.length > 10) {
            console.log(colors.dim(`  ... and ${result.onlyInTarget.length - 10} more`));
          }
        }
      }
    }
  }

  if (!options.silent) {
    output.newline();
    output.success('Diff complete');
  }

  return results;
}
