import fs from 'node:fs';
import path from 'node:path';
import type { TranslateOptions, TranslateResult, TranslationJson } from '../types/index.js';
import { getEmptyStrings, setNestedValue } from '../core/json-utils.js';
import { translateWithConcurrency } from '../core/translator.js';

const DEFAULT_LOCALES_PATH = 'public/locales';
const DEFAULT_SOURCE_LANGUAGE = 'ru';
const DEFAULT_TARGET_LANGUAGES = ['en', 'kk'];

export interface TranslateCommandOptions extends TranslateOptions {
  /** Silent mode - no console output */
  silent?: boolean;
}

/**
 * Auto-translate empty strings in target language files using Google Translate
 */
export async function translate(options: TranslateCommandOptions = {}): Promise<TranslateResult> {
  const root = options.root || process.cwd();
  const localesPath = options.localesPath || DEFAULT_LOCALES_PATH;
  const from = options.from || DEFAULT_SOURCE_LANGUAGE;
  const to = options.to || DEFAULT_TARGET_LANGUAGES;
  const batchSize = options.batchSize || 50;
  const concurrency = options.concurrency || 5;

  const localesDir = path.join(root, localesPath);

  if (!options.silent) {
    console.log('=== Auto-translating locales ===\n');
  }

  // Load source language
  const sourceFile = path.join(localesDir, from, 'translation.json');
  let sourceJson: TranslationJson;

  try {
    sourceJson = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  } catch (e) {
    if (!options.silent) {
      console.error(`❌ Failed to load source file: ${sourceFile}`);
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
        console.warn(`⚠ File not found: ${targetFile}, skipping`);
      }
      continue;
    }

    // Find empty strings
    const emptyStrings = getEmptyStrings(targetJson, sourceJson);

    if (!options.silent) {
      console.log(`\n--- ${targetLang.toUpperCase()} ---`);
      console.log(`Found ${emptyStrings.length} empty strings`);
    }

    if (emptyStrings.length === 0) {
      result.languages.push({ code: targetLang, translated: 0 });
      continue;
    }

    // Translate
    const textsToTranslate = emptyStrings.map((item) => item.sourceValue);

    if (!options.silent) {
      console.log(`Translating ${textsToTranslate.length} texts from ${from} to ${targetLang}...`);
    }

    const translated = await translateWithConcurrency({
      texts: textsToTranslate,
      from,
      to: targetLang,
      batchSize,
      concurrency,
      onProgress: options.silent
        ? undefined
        : (done, total) => {
            process.stdout.write(`\rProgress: ${done}/${total}`);
          },
    });

    if (!options.silent) {
      console.log(''); // New line after progress
    }

    // Apply translations
    for (let i = 0; i < emptyStrings.length; i++) {
      setNestedValue(targetJson, emptyStrings[i].key, translated[i]);
    }

    // Save
    fs.writeFileSync(targetFile, JSON.stringify(targetJson, null, 2) + '\n', 'utf8');

    if (!options.silent) {
      console.log(`✓ Saved ${targetFile}`);
    }

    result.languages.push({ code: targetLang, translated: emptyStrings.length });
  }

  if (!options.silent) {
    console.log('\n✓ Done!');
  }

  return result;
}
