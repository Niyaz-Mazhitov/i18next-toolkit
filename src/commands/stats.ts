/**
 * @fileoverview Stats command - show translation statistics.
 * Displays coverage, progress, and detailed breakdown by namespace.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { TranslationJson } from '../types/index.js';
import { countKeys, countFilled, flattenKeys } from '../core/json-utils.js';
import { colors, output, Table, formatPercent, formatSize } from '../core/output.js';

const DEFAULT_LOCALES_PATH = 'public/locales';

/**
 * Stats for a single language
 */
export interface LanguageStats {
  /** Language code */
  code: string;
  /** Total keys */
  totalKeys: number;
  /** Filled (non-empty) keys */
  filledKeys: number;
  /** Empty keys */
  emptyKeys: number;
  /** Coverage percentage */
  coverage: number;
  /** File size in bytes */
  fileSize: number;
  /** Breakdown by top-level namespace */
  namespaces: Record<string, { total: number; filled: number }>;
}

/**
 * Overall statistics result
 */
export interface StatsResult {
  /** All unique keys across languages */
  uniqueKeys: number;
  /** Stats per language */
  languages: LanguageStats[];
  /** Top untranslated keys */
  topUntranslated: { key: string; languages: string[] }[];
}

/**
 * Options for stats command
 */
export interface StatsOptions {
  /** Root directory */
  root?: string;
  /** Path to locales directory */
  localesPath?: string;
  /** Languages to analyze */
  languages?: string[];
  /** Show namespace breakdown */
  showNamespaces?: boolean;
  /** Show top untranslated keys */
  showUntranslated?: number;
  /** Silent mode */
  silent?: boolean;
}

/**
 * Count keys by namespace (top-level keys)
 */
function countByNamespace(
  obj: TranslationJson
): Record<string, { total: number; filled: number }> {
  const result: Record<string, { total: number; filled: number }> = {};

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = {
        total: countKeys(value),
        filled: countFilled(value),
      };
    } else {
      // Top-level string - count as "root" namespace
      if (!result['_root']) {
        result['_root'] = { total: 0, filled: 0 };
      }
      result['_root'].total++;
      if (typeof value === 'string' && value.trim() !== '') {
        result['_root'].filled++;
      }
    }
  }

  return result;
}

/**
 * Find keys that are empty in multiple languages
 */
function findUntranslatedKeys(
  allTranslations: Map<string, Map<string, string>>,
  sourceLanguage: string
): { key: string; languages: string[] }[] {
  const sourceMap = allTranslations.get(sourceLanguage);
  if (!sourceMap) return [];

  const untranslated: Map<string, string[]> = new Map();

  for (const key of sourceMap.keys()) {
    const missingIn: string[] = [];

    for (const [lang, translations] of allTranslations) {
      if (lang === sourceLanguage) continue;
      const value = translations.get(key);
      if (!value || value.trim() === '') {
        missingIn.push(lang);
      }
    }

    if (missingIn.length > 0) {
      untranslated.set(key, missingIn);
    }
  }

  // Sort by number of missing languages (most missing first)
  return Array.from(untranslated.entries())
    .map(([key, languages]) => ({ key, languages }))
    .sort((a, b) => b.languages.length - a.languages.length);
}

/**
 * Show translation statistics.
 * Displays coverage, file sizes, and breakdown by namespace.
 *
 * @param options - Stats options
 * @returns Statistics result
 *
 * @example
 * ```typescript
 * const result = await stats({
 *   showNamespaces: true,
 *   showUntranslated: 10,
 * });
 * console.log(`Total coverage: ${result.languages[0].coverage}%`);
 * ```
 */
export async function stats(options: StatsOptions = {}): Promise<StatsResult> {
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
      return { uniqueKeys: 0, languages: [], topUntranslated: [] };
    }
  }

  if (!options.silent) {
    output.header('Translation Statistics');
    output.keyValue('Locales path', localesPath);
    output.keyValue('Languages', languages.join(', '));
    output.newline();
  }

  const languageStats: LanguageStats[] = [];
  const allTranslations: Map<string, Map<string, string>> = new Map();
  const allKeys = new Set<string>();

  // Analyze each language
  for (const lang of languages) {
    const filePath = path.join(localesDir, lang, 'translation.json');

    try {
      const fileStats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const json = JSON.parse(content) as TranslationJson;

      const flatMap = flattenKeys(json);
      allTranslations.set(lang, flatMap);

      // Collect all keys
      for (const key of flatMap.keys()) {
        allKeys.add(key);
      }

      const totalKeys = countKeys(json);
      const filledKeys = countFilled(json);
      const emptyKeys = totalKeys - filledKeys;
      const coverage = totalKeys > 0 ? Math.round((filledKeys / totalKeys) * 100) : 0;

      languageStats.push({
        code: lang,
        totalKeys,
        filledKeys,
        emptyKeys,
        coverage,
        fileSize: fileStats.size,
        namespaces: countByNamespace(json),
      });
    } catch (error) {
      if (!options.silent) {
        output.warn(`Could not load ${lang}: ${(error as Error).message}`);
      }
    }
  }

  // Print overview table
  if (!options.silent) {
    output.section('Overview');

    const table = new Table(['Language', 'Keys', 'Filled', 'Empty', 'Coverage', 'Size']);

    for (const stat of languageStats) {
      const coverageStr = formatPercent(stat.filledKeys, stat.totalKeys);
      table.addRow([
        colors.lang(stat.code.toUpperCase()),
        stat.totalKeys,
        colors.success(String(stat.filledKeys)),
        stat.emptyKeys > 0 ? colors.warning(String(stat.emptyKeys)) : colors.dim('0'),
        coverageStr,
        formatSize(stat.fileSize),
      ]);
    }

    table.print();
  }

  // Print namespace breakdown
  if (options.showNamespaces && !options.silent) {
    output.section('By Namespace');

    // Collect all namespaces
    const allNamespaces = new Set<string>();
    for (const stat of languageStats) {
      for (const ns of Object.keys(stat.namespaces)) {
        allNamespaces.add(ns);
      }
    }

    const sortedNamespaces = Array.from(allNamespaces).sort();

    for (const ns of sortedNamespaces) {
      const displayName = ns === '_root' ? '(root level)' : ns;
      console.log(`\n  ${colors.bold(displayName)}`);

      for (const stat of languageStats) {
        const nsStats = stat.namespaces[ns];
        if (nsStats) {
          const coverage = formatPercent(nsStats.filled, nsStats.total);
          console.log(`    ${colors.lang(stat.code)}: ${nsStats.filled}/${nsStats.total} ${coverage}`);
        }
      }
    }
  }

  // Find and show top untranslated keys
  const topUntranslated = findUntranslatedKeys(allTranslations, languages[0]);

  if (options.showUntranslated && options.showUntranslated > 0 && !options.silent) {
    const limit = options.showUntranslated;
    const toShow = topUntranslated.slice(0, limit);

    if (toShow.length > 0) {
      output.section(`Top ${limit} Untranslated Keys`);

      for (const { key, languages: missingLangs } of toShow) {
        const langList = missingLangs.map(l => colors.lang(l)).join(', ');
        console.log(`  ${colors.key(key)}`);
        console.log(`    ${colors.dim('Missing in:')} ${langList}`);
      }

      if (topUntranslated.length > limit) {
        output.newline();
        output.dim(`  ... and ${topUntranslated.length - limit} more untranslated keys`);
      }
    }
  }

  // Summary
  if (!options.silent) {
    output.newline();
    output.separator();
    output.keyValue('Total unique keys', allKeys.size);
    output.keyValue('Untranslated keys', topUntranslated.length);
    output.newline();
    output.success('Stats complete');
  }

  return {
    uniqueKeys: allKeys.size,
    languages: languageStats,
    topUntranslated,
  };
}
