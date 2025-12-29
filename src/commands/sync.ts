import fs from 'node:fs';
import path from 'node:path';
import type { SyncOptions, SyncResult, TranslationJson } from '../types/index.js';
import {
  collectAllKeys,
  countFilled,
  countKeys,
  createEmptyTemplate,
  fillFromSource,
  sortKeys,
} from '../core/json-utils.js';
import { colors, output, formatPercent } from '../core/output.js';

const DEFAULT_LANGUAGES = ['ru', 'en', 'kk'];
const DEFAULT_LOCALES_PATH = 'public/locales';

/**
 * Load JSON file with error handling
 * @param filePath - Path to JSON file
 * @param silent - Whether to suppress warnings
 * @returns Parsed JSON or empty object if file doesn't exist
 */
function loadJson(filePath: string, silent = false): TranslationJson {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const isNotFound = (error as NodeJS.ErrnoException).code === 'ENOENT';
    if (!isNotFound && !silent) {
      output.warn(`Could not load ${filePath}: ${(error as Error).message}`);
    }
    return {};
  }
}

/**
 * Save JSON file
 */
function saveJson(filePath: string, data: TranslationJson): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export interface SyncCommandOptions extends SyncOptions {
  /** Silent mode - no console output */
  silent?: boolean;
}

/**
 * Sync locale files structure across languages.
 * Ensures all languages have the same keys.
 * First language is treated as source (values are preserved).
 * Other languages get empty strings for new keys.
 */
export async function sync(options: SyncCommandOptions = {}): Promise<SyncResult> {
  const root = options.root || process.cwd();
  const localesPath = options.localesPath || DEFAULT_LOCALES_PATH;
  const languages = options.languages || DEFAULT_LANGUAGES;
  const localesDir = path.join(root, localesPath);

  if (!options.silent) {
    output.header('Sync Locales');
    output.keyValue('Languages', languages.join(', '));
    output.newline();
  }

  // Load all translations
  const translations: Record<string, TranslationJson> = {};

  for (const lang of languages) {
    const filePath = path.join(localesDir, lang, 'translation.json');
    translations[lang] = loadJson(filePath, options.silent);

    if (!options.silent) {
      output.dim(`  Loaded ${colors.lang(lang)}: ${countKeys(translations[lang])} keys`);
    }
  }

  // Collect all unique keys from all languages
  const allKeys = collectAllKeys(Object.values(translations));
  const totalKeys = countKeys(allKeys);

  if (!options.silent) {
    output.newline();
    output.keyValue('Total unique keys', totalKeys);
  }

  // Create result
  const result: Record<string, TranslationJson> = {};

  // First language (source): fill all keys with values from source
  const sourceLanguage = languages[0];
  result[sourceLanguage] = sortKeys(fillFromSource(allKeys, translations[sourceLanguage]));

  // Other languages: take existing translations or empty strings
  for (const lang of languages.slice(1)) {
    result[lang] = sortKeys(createEmptyTemplate(allKeys, translations[lang]));
  }

  // Save results
  const languageStats: SyncResult['languages'] = [];

  for (const lang of languages) {
    const filePath = path.join(localesDir, lang, 'translation.json');

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    saveJson(filePath, result[lang]);

    const filled = countFilled(result[lang]);
    const percent = totalKeys > 0 ? Math.round((filled / totalKeys) * 100) : 0;

    languageStats.push({
      code: lang,
      filled,
      total: totalKeys,
      percent,
    });

    if (!options.silent) {
      const percentColor = percent >= 90 ? colors.success : percent >= 50 ? colors.warning : colors.error;
      console.log(`  ${colors.lang(lang.toUpperCase())}: ${filled}/${totalKeys} filled (${percentColor(formatPercent(percent))})`);
    }
  }

  if (!options.silent) {
    output.newline();
    output.separator();
    output.success('Sync complete! You can now translate empty strings.');
  }

  return {
    totalKeys,
    languages: languageStats,
  };
}
