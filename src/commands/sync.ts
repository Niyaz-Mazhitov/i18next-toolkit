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

const DEFAULT_LANGUAGES = ['ru', 'en', 'kk'];
const DEFAULT_LOCALES_PATH = 'public/locales';

/**
 * Load JSON file
 */
function loadJson(filePath: string): TranslationJson {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
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
    console.log('=== Syncing locales ===\n');
  }

  // Load all translations
  const translations: Record<string, TranslationJson> = {};

  for (const lang of languages) {
    const filePath = path.join(localesDir, lang, 'translation.json');
    translations[lang] = loadJson(filePath);

    if (!options.silent) {
      console.log(`Loaded ${lang}: ${countKeys(translations[lang])} keys`);
    }
  }

  // Collect all unique keys from all languages
  const allKeys = collectAllKeys(Object.values(translations));
  const totalKeys = countKeys(allKeys);

  if (!options.silent) {
    console.log(`\nTotal unique keys: ${totalKeys}`);
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
      console.log(`Saved ${lang}: ${filled}/${totalKeys} filled (${percent}%)`);
    }
  }

  if (!options.silent) {
    console.log('\n✓ Done! Now you can translate empty strings in target languages.');
  }

  return {
    totalKeys,
    languages: languageStats,
  };
}
