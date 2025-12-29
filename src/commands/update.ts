import type { TranslateResult, SyncResult } from '../types/index.js';
import { sync } from './sync.js';
import { translate } from './translate.js';
import { colors, output } from '../core/output.js';

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
    output.header('Update Locales');
    output.keyValue('Source', sourceLanguage);
    output.keyValue('Targets', targetLanguages.join(', '));
    output.keyValue('Path', localesPath);
    output.newline();
  }

  // Step 1: Sync
  if (!options.silent) {
    output.step(1, 2, 'Syncing locale structure');
  }

  const syncResult = await sync({
    root,
    localesPath,
    languages: allLanguages,
    silent: options.silent,
  });

  if (!options.silent) {
    output.newline();
  }

  // Step 2: Translate
  if (!options.silent) {
    output.step(2, 2, 'Auto-translating strings');
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
    output.newline();
    output.header('Summary');
    output.keyValue('Total keys', syncResult.totalKeys);
    output.newline();

    for (const lang of syncResult.languages) {
      const translated = translateResult.languages.find(l => l.code === lang.code);
      const newlyTranslated = translated?.translated || 0;
      const newlyText = newlyTranslated > 0 ? colors.success(` [+${newlyTranslated} translated]`) : '';

      console.log(`  ${colors.lang(lang.code.toUpperCase())}: ${lang.filled}/${lang.total} (${lang.percent}%)${newlyText}`);
    }

    output.newline();
    output.separator();
    output.success('Update complete!');
  }

  return {
    sync: syncResult,
    translate: translateResult,
  };
}
