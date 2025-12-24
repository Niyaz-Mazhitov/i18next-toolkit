import type { TranslateResult, SyncResult } from '../types/index.js';
import { sync } from './sync.js';
import { translate } from './translate.js';

export interface UpdateOptions {
  /** Root directory of the project */
  root?: string;
  /** Path to locales directory */
  localesPath?: string;
  /** Source language */
  sourceLanguage?: string;
  /** Target languages */
  targetLanguages?: string[];
  /** Batch size for translation */
  batchSize?: number;
  /** Concurrency for translation */
  concurrency?: number;
  /** Silent mode */
  silent?: boolean;
}

export interface UpdateResult {
  sync: SyncResult;
  translate: TranslateResult;
}

const DEFAULT_LOCALES_PATH = 'public/locales';
const DEFAULT_SOURCE_LANGUAGE = 'ru';
const DEFAULT_TARGET_LANGUAGES = ['en', 'kk'];

/**
 * Update locales: sync structure and auto-translate empty strings
 *
 * This is a convenience command that runs:
 * 1. sync - ensures all languages have the same keys
 * 2. translate - fills empty strings with Google Translate
 */
export async function update(options: UpdateOptions = {}): Promise<UpdateResult> {
  const root = options.root || process.cwd();
  const localesPath = options.localesPath || DEFAULT_LOCALES_PATH;
  const sourceLanguage = options.sourceLanguage || DEFAULT_SOURCE_LANGUAGE;
  const targetLanguages = options.targetLanguages || DEFAULT_TARGET_LANGUAGES;
  const batchSize = options.batchSize || 50;
  const concurrency = options.concurrency || 5;

  // All languages including source
  const allLanguages = [sourceLanguage, ...targetLanguages.filter(l => l !== sourceLanguage)];

  if (!options.silent) {
    console.log('╔════════════════════════════════════════╗');
    console.log('║         LOCALE-SYNC UPDATE             ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`Source language: ${sourceLanguage}`);
    console.log(`Target languages: ${targetLanguages.join(', ')}`);
    console.log(`Locales path: ${localesPath}\n`);
  }

  // Step 1: Sync
  if (!options.silent) {
    console.log('┌────────────────────────────────────────┐');
    console.log('│  Step 1/2: Syncing locale structure    │');
    console.log('└────────────────────────────────────────┘\n');
  }

  const syncResult = await sync({
    root,
    localesPath,
    languages: allLanguages,
    silent: options.silent,
  });

  if (!options.silent) {
    console.log('\n');
  }

  // Step 2: Translate
  if (!options.silent) {
    console.log('┌────────────────────────────────────────┐');
    console.log('│  Step 2/2: Auto-translating strings    │');
    console.log('└────────────────────────────────────────┘\n');
  }

  const translateResult = await translate({
    root,
    localesPath,
    from: sourceLanguage,
    to: targetLanguages,
    batchSize,
    concurrency,
    silent: options.silent,
  });

  // Summary
  if (!options.silent) {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║              SUMMARY                   ║');
    console.log('╚════════════════════════════════════════╝\n');

    console.log(`Total keys: ${syncResult.totalKeys}`);
    console.log('\nLanguage stats:');

    for (const lang of syncResult.languages) {
      const translated = translateResult.languages.find(l => l.code === lang.code);
      const newlyTranslated = translated?.translated || 0;

      console.log(`  ${lang.code.toUpperCase()}: ${lang.filled}/${lang.total} (${lang.percent}%)${newlyTranslated > 0 ? ` [+${newlyTranslated} translated]` : ''}`);
    }

    console.log('\n✓ Update complete!');
  }

  return {
    sync: syncResult,
    translate: translateResult,
  };
}
