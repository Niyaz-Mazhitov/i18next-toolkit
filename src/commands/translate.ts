import fs from 'node:fs';
import path from 'node:path';
import type { TranslateOptions, TranslateResult, TranslationJson } from '../types/index.js';
import { getEmptyStrings, setNestedValue } from '../core/json-utils.js';
import { translateWithConcurrency } from '../core/translator.js';
import { createCache, TranslationCache } from '../core/cache.js';
import { colors, output, createProgressBar } from '../core/output.js';

const DEFAULT_LOCALES_PATH = 'public/locales';
const DEFAULT_SOURCE_LANGUAGE = 'ru';
const DEFAULT_TARGET_LANGUAGES = ['en', 'kk'];

export interface TranslateCommandOptions extends TranslateOptions {
  /** Silent mode - no console output */
  silent?: boolean;
  /** Enable translation caching (default: true) */
  useCache?: boolean;
  /** Path to cache file */
  cachePath?: string;
}

/**
 * Auto-translate empty strings in target language files using Google Translate.
 * Supports caching to avoid redundant API calls.
 *
 * @param options - Translation options
 * @returns Translation result with per-language statistics
 *
 * @example
 * ```typescript
 * const result = await translate({
 *   from: 'ru',
 *   to: ['en', 'kk'],
 *   useCache: true,
 * });
 * console.log(`Translated ${result.languages[0].translated} strings to English`);
 * ```
 */
export async function translate(options: TranslateCommandOptions = {}): Promise<TranslateResult> {
  const root = options.root || process.cwd();
  const localesPath = options.localesPath || DEFAULT_LOCALES_PATH;
  const from = options.from || DEFAULT_SOURCE_LANGUAGE;
  const to = options.to || DEFAULT_TARGET_LANGUAGES;
  const batchSize = options.batchSize || 50;
  const concurrency = options.concurrency || 5;
  const useCache = options.useCache !== false; // default true

  const localesDir = path.join(root, localesPath);

  if (!options.silent) {
    output.header('Auto-translate Locales');
    output.keyValue('Source', from);
    output.keyValue('Targets', to.join(', '));
    output.newline();
  }

  // Initialize cache if enabled
  let cache: TranslationCache | null = null;
  if (useCache) {
    cache = await createCache(root, options.cachePath);
    const stats = cache.stats();
    if (!options.silent && stats.entries > 0) {
      output.info(`Loaded translation cache (${stats.entries} entries)`);
      output.newline();
    }
  }

  // Load source language
  const sourceFile = path.join(localesDir, from, 'translation.json');
  let sourceJson: TranslationJson;

  try {
    sourceJson = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  } catch (e) {
    if (!options.silent) {
      output.error(`Failed to load source file: ${sourceFile}`);
    }
    return { languages: [] };
  }

  const result: TranslateResult = { languages: [] };

  for (const targetLang of to) {
    const targetFile = path.join(localesDir, targetLang, 'translation.json');

    let targetJson: TranslationJson;
    try {
      targetJson = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
    } catch {
      if (!options.silent) {
        output.warn(`File not found: ${targetFile}, skipping`);
      }
      continue;
    }

    // Find empty strings
    const emptyStrings = getEmptyStrings(targetJson, sourceJson);

    if (!options.silent) {
      output.section(colors.lang(targetLang.toUpperCase()));
      output.keyValue('Empty strings', emptyStrings.length);
    }

    if (emptyStrings.length === 0) {
      result.languages.push({ code: targetLang, translated: 0 });
      continue;
    }

    const textsToTranslate = emptyStrings.map((item) => item.sourceValue);
    let translated: string[];
    let fromCache = 0;

    if (cache) {
      // Check cache first
      const { cached, uncached } = cache.getMany(textsToTranslate, from, targetLang);
      fromCache = cached.size;

      if (!options.silent && fromCache > 0) {
        output.dim(`  Found ${fromCache} translations in cache`);
      }

      if (uncached.length > 0) {
        if (!options.silent) {
          output.dim(`  Translating ${uncached.length} texts...`);
        }

        // Translate only uncached texts
        const progressBar = !options.silent ? createProgressBar(uncached.length) : null;
        progressBar?.start();

        const newTranslations = await translateWithConcurrency({
          texts: uncached,
          from,
          to: targetLang,
          batchSize,
          concurrency,
          onProgress: progressBar
            ? (done) => progressBar.update(done)
            : undefined,
        });

        progressBar?.stop();

        // Cache new translations
        for (let i = 0; i < uncached.length; i++) {
          cache.set(uncached[i], newTranslations[i], from, targetLang);
          cached.set(uncached[i], newTranslations[i]);
        }
      }

      // Build result array in original order
      translated = textsToTranslate.map((text) => cached.get(text) || text);
    } else {
      // No cache - translate all
      if (!options.silent) {
        output.dim(`  Translating ${textsToTranslate.length} texts...`);
      }

      const progressBar = !options.silent ? createProgressBar(textsToTranslate.length) : null;
      progressBar?.start();

      translated = await translateWithConcurrency({
        texts: textsToTranslate,
        from,
        to: targetLang,
        batchSize,
        concurrency,
        onProgress: progressBar
          ? (done) => progressBar.update(done)
          : undefined,
      });

      progressBar?.stop();
    }

    // Apply translations
    for (let i = 0; i < emptyStrings.length; i++) {
      setNestedValue(targetJson, emptyStrings[i].key, translated[i]);
    }

    // Save
    fs.writeFileSync(targetFile, JSON.stringify(targetJson, null, 2) + '\n', 'utf8');

    if (!options.silent) {
      output.success(`Translated ${emptyStrings.length} strings`);
    }

    result.languages.push({ code: targetLang, translated: emptyStrings.length });
  }

  // Save cache
  if (cache) {
    await cache.save();
  }

  if (!options.silent) {
    output.newline();
    output.separator();
    output.success('Translation complete!');
  }

  return result;
}
