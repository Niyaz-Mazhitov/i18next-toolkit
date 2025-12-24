#!/usr/bin/env node
import { Command } from 'commander';
import { extract } from './commands/extract.js';
import { findMissing } from './commands/find-missing.js';
import { sync } from './commands/sync.js';
import { translate } from './commands/translate.js';
import { update } from './commands/update.js';

const program = new Command();

program
  .name('i18next-toolkit')
  .description('i18n automation toolkit - extract, sync, and translate locales')
  .version('1.0.0');

// Extract command
program
  .command('extract')
  .description('Extract Russian strings from code and replace with t() calls')
  .option('-m, --mode <mode>', 'Mode: report, extract, or validate', 'report')
  .option('-d, --dry-run', 'Do not save changes')
  .option('-f, --file <path>', 'Process only this file')
  .option('-i, --include <pattern>', 'Glob pattern for files', 'src/**/*.{ts,tsx,js,jsx}')
  .option('-l, --locales-path <path>', 'Path to locales directory', 'public/locales')
  .option('-c, --category <name>', 'Category prefix for keys', 'extracted')
  .option('--auto-getters', 'Use getters for module-level constants')
  .action(async (options) => {
    try {
      await extract({
        mode: options.mode,
        dryRun: options.dryRun,
        file: options.file,
        include: options.include,
        localesPath: options.localesPath,
        category: options.category,
        autoGetters: options.autoGetters,
      });
    } catch (e) {
      console.error('Error:', (e as Error).message);
      process.exit(1);
    }
  });

// Find missing command
program
  .command('find-missing')
  .description('Find translation keys used in code but missing from translation file')
  .option('-i, --include <pattern>', 'Glob pattern for files', 'src/**/*.{ts,tsx,js,jsx}')
  .option('-l, --locales-path <path>', 'Path to locales directory', 'public/locales')
  .option('-s, --source-language <lang>', 'Source language code', 'ru')
  .action(async (options) => {
    try {
      const result = await findMissing({
        include: options.include,
        localesPath: options.localesPath,
        sourceLanguage: options.sourceLanguage,
      });

      if (result.missingKeysCount > 0) {
        process.exit(1);
      }
    } catch (e) {
      console.error('Error:', (e as Error).message);
      process.exit(1);
    }
  });

// Sync command
program
  .command('sync')
  .description('Sync locale files structure across languages')
  .option('-l, --locales-path <path>', 'Path to locales directory', 'public/locales')
  .option('--languages <langs>', 'Comma-separated list of languages', 'ru,en,kk')
  .action(async (options) => {
    try {
      await sync({
        localesPath: options.localesPath,
        languages: options.languages.split(','),
      });
    } catch (e) {
      console.error('Error:', (e as Error).message);
      process.exit(1);
    }
  });

// Translate command
program
  .command('translate')
  .description('Auto-translate empty strings using Google Translate')
  .option('-l, --locales-path <path>', 'Path to locales directory', 'public/locales')
  .option('-f, --from <lang>', 'Source language', 'ru')
  .option('-t, --to <langs>', 'Target languages (comma-separated)', 'en,kk')
  .option('-b, --batch-size <n>', 'Batch size for parallel requests', '50')
  .option('-c, --concurrency <n>', 'Number of concurrent requests', '5')
  .action(async (options) => {
    try {
      await translate({
        localesPath: options.localesPath,
        from: options.from,
        to: options.to.split(','),
        batchSize: parseInt(options.batchSize, 10),
        concurrency: parseInt(options.concurrency, 10),
      });
    } catch (e) {
      console.error('Error:', (e as Error).message);
      process.exit(1);
    }
  });

// Update command (sync + translate in one step)
program
  .command('update')
  .description('Sync locale structure and auto-translate in one step')
  .option('-l, --locales-path <path>', 'Path to locales directory', 'public/locales')
  .option('-s, --source <lang>', 'Source language', 'ru')
  .option('-t, --target <langs>', 'Target languages (comma-separated)', 'en,kk')
  .option('-b, --batch-size <n>', 'Batch size for parallel requests', '50')
  .option('-c, --concurrency <n>', 'Number of concurrent requests', '5')
  .action(async (options) => {
    try {
      await update({
        localesPath: options.localesPath,
        sourceLanguage: options.source,
        targetLanguages: options.target.split(','),
        batchSize: parseInt(options.batchSize, 10),
        concurrency: parseInt(options.concurrency, 10),
      });
    } catch (e) {
      console.error('Error:', (e as Error).message);
      process.exit(1);
    }
  });

program.parse();
