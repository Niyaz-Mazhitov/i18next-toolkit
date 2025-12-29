#!/usr/bin/env node
import { Command } from 'commander';
import { extract } from './commands/extract.js';
import { findMissing } from './commands/find-missing.js';
import { sync } from './commands/sync.js';
import { translate } from './commands/translate.js';
import { update } from './commands/update.js';
import { watchCommand } from './commands/watch.js';
import { diff } from './commands/diff.js';
import { stats } from './commands/stats.js';
import { clean } from './commands/clean.js';
import { sort } from './commands/sort.js';
import { validate } from './commands/validate.js';
import { completion } from './commands/completion.js';
import { loadConfig, createConfigTemplate, validateConfig } from './core/config.js';
import { colors, output } from './core/output.js';

const program = new Command();

// Load configuration
const config = loadConfig();

// Validate configuration
const configErrors = validateConfig(config);
if (configErrors.length > 0) {
  output.warn('Configuration warnings:');
  configErrors.forEach((err) => console.warn(`  ${colors.dim('-')} ${err}`));
  console.log('');
}

program
  .name('i18next-toolkit')
  .description(colors.dim('i18n automation toolkit - extract, sync, and translate locales'))
  .version('1.1.0');

// Init command
program
  .command('init')
  .description('Create a configuration file (.i18next-toolkitrc.json)')
  .action(() => {
    try {
      const configPath = createConfigTemplate();
      output.success(`Created configuration file: ${colors.path(configPath)}`);
      console.log('');
      output.dim('You can now customize the settings in this file.');
    } catch (e) {
      output.error((e as Error).message);
      process.exit(1);
    }
  });

// Extract command
program
  .command('extract')
  .description('Extract strings from code and replace with t() calls')
  .option('-m, --mode <mode>', 'Mode: report, extract, or validate', 'report')
  .option('-d, --dry-run', 'Do not save changes')
  .option('-f, --file <path>', 'Process only this file')
  .option('-i, --include <pattern>', 'Glob pattern for files', config.include)
  .option('-l, --locales-path <path>', 'Path to locales directory', config.localesPath)
  .option('-c, --category <name>', 'Category prefix for keys', config.category)
  .option('-p, --source-pattern <regex>', 'Regex pattern to match source strings', config.sourcePattern)
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
        sourcePattern: options.sourcePattern,
      });
    } catch (e) {
      output.error((e as Error).message);
      process.exit(1);
    }
  });

// Find missing command
program
  .command('find-missing')
  .description('Find translation keys used in code but missing from translation file')
  .option('-i, --include <pattern>', 'Glob pattern for files', config.include)
  .option('-l, --locales-path <path>', 'Path to locales directory', config.localesPath)
  .option('-s, --source-language <lang>', 'Source language code', config.sourceLanguage)
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
      output.error((e as Error).message);
      process.exit(1);
    }
  });

// Sync command
program
  .command('sync')
  .description('Sync locale files structure across languages')
  .option('-l, --locales-path <path>', 'Path to locales directory', config.localesPath)
  .option('--languages <langs>', 'Comma-separated list of languages', [config.sourceLanguage, ...config.targetLanguages].join(','))
  .action(async (options) => {
    try {
      await sync({
        localesPath: options.localesPath,
        languages: options.languages.split(','),
      });
    } catch (e) {
      output.error((e as Error).message);
      process.exit(1);
    }
  });

// Translate command
program
  .command('translate')
  .description('Auto-translate empty strings using Google Translate')
  .option('-l, --locales-path <path>', 'Path to locales directory', config.localesPath)
  .option('-f, --from <lang>', 'Source language', config.sourceLanguage)
  .option('-t, --to <langs>', 'Target languages (comma-separated)', config.targetLanguages.join(','))
  .option('-b, --batch-size <n>', 'Batch size for parallel requests', String(config.batchSize))
  .option('-c, --concurrency <n>', 'Number of concurrent requests', String(config.concurrency))
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
      output.error((e as Error).message);
      process.exit(1);
    }
  });

// Update command
program
  .command('update')
  .description('Sync locale structure and auto-translate in one step')
  .option('-l, --locales-path <path>', 'Path to locales directory', config.localesPath)
  .option('-s, --source <lang>', 'Source language', config.sourceLanguage)
  .option('-t, --target <langs>', 'Target languages (comma-separated)', config.targetLanguages.join(','))
  .option('-b, --batch-size <n>', 'Batch size for parallel requests', String(config.batchSize))
  .option('-c, --concurrency <n>', 'Number of concurrent requests', String(config.concurrency))
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
      output.error((e as Error).message);
      process.exit(1);
    }
  });

// Watch command
program
  .command('watch')
  .description('Watch for file changes and extract strings automatically')
  .option('-i, --include <pattern>', 'Glob pattern for files', config.include)
  .option('-l, --locales-path <path>', 'Path to locales directory', config.localesPath)
  .option('-c, --category <name>', 'Category prefix for keys', config.category)
  .option('-p, --source-pattern <regex>', 'Regex pattern to match source strings', config.sourcePattern)
  .option('-d, --debounce <ms>', 'Debounce delay in milliseconds', '300')
  .action(async (options) => {
    try {
      await watchCommand({
        include: options.include,
        localesPath: options.localesPath,
        category: options.category,
        sourcePattern: options.sourcePattern,
        debounce: parseInt(options.debounce, 10),
      });
    } catch (e) {
      output.error((e as Error).message);
      process.exit(1);
    }
  });

// Diff command
program
  .command('diff')
  .description('Show differences between language files')
  .option('-l, --locales-path <path>', 'Path to locales directory', config.localesPath)
  .option('-s, --source <lang>', 'Source language to compare from', config.sourceLanguage)
  .option('-t, --target <langs>', 'Target languages (comma-separated)')
  .option('--detailed', 'Show detailed key list')
  .action(async (options) => {
    try {
      await diff({
        localesPath: options.localesPath,
        source: options.source,
        target: options.target?.split(','),
        detailed: options.detailed,
      });
    } catch (e) {
      output.error((e as Error).message);
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Show translation statistics')
  .option('-l, --locales-path <path>', 'Path to locales directory', config.localesPath)
  .option('--languages <langs>', 'Comma-separated list of languages')
  .option('--show-namespaces', 'Show breakdown by namespace')
  .option('--show-untranslated <n>', 'Show top N untranslated keys', '10')
  .action(async (options) => {
    try {
      await stats({
        localesPath: options.localesPath,
        languages: options.languages?.split(','),
        showNamespaces: options.showNamespaces,
        showUntranslated: parseInt(options.showUntranslated, 10),
      });
    } catch (e) {
      output.error((e as Error).message);
      process.exit(1);
    }
  });

// Clean command
program
  .command('clean')
  .description('Remove unused translation keys')
  .option('-l, --locales-path <path>', 'Path to locales directory', config.localesPath)
  .option('-i, --include <pattern>', 'Glob pattern for source files', config.include)
  .option('--languages <langs>', 'Comma-separated list of languages')
  .option('-d, --dry-run', 'Show what would be removed without removing')
  .action(async (options) => {
    try {
      const result = await clean({
        localesPath: options.localesPath,
        include: options.include,
        languages: options.languages?.split(','),
        dryRun: options.dryRun,
      });

      if (options.dryRun && result.removedCount > 0) {
        process.exit(1);
      }
    } catch (e) {
      output.error((e as Error).message);
      process.exit(1);
    }
  });

// Sort command
program
  .command('sort')
  .description('Sort translation keys alphabetically')
  .option('-l, --locales-path <path>', 'Path to locales directory', config.localesPath)
  .option('--languages <langs>', 'Comma-separated list of languages')
  .option('--check', 'Check if files are sorted without modifying')
  .action(async (options) => {
    try {
      const result = await sort({
        localesPath: options.localesPath,
        languages: options.languages?.split(','),
        check: options.check,
      });

      if (options.check && result.sortedFiles.length > 0) {
        process.exit(1);
      }
    } catch (e) {
      output.error((e as Error).message);
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate translation files for issues')
  .option('-l, --locales-path <path>', 'Path to locales directory', config.localesPath)
  .option('--languages <langs>', 'Comma-separated list of languages')
  .option('-s, --source <lang>', 'Source language for comparison', config.sourceLanguage)
  .option('--strict', 'Treat warnings as errors')
  .action(async (options) => {
    try {
      const result = await validate({
        localesPath: options.localesPath,
        languages: options.languages?.split(','),
        source: options.source,
        strict: options.strict,
      });

      if (!result.valid) {
        process.exit(1);
      }
    } catch (e) {
      output.error((e as Error).message);
      process.exit(1);
    }
  });

// Completion command
program
  .command('completion')
  .description('Generate shell completion script')
  .option('--shell <type>', 'Shell type: bash, zsh, or fish')
  .action(async (options) => {
    try {
      await completion({
        shell: options.shell,
      });
    } catch (e) {
      output.error((e as Error).message);
      process.exit(1);
    }
  });

program.parse();
