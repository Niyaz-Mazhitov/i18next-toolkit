/**
 * @fileoverview i18next-toolkit - i18n automation toolkit for i18next.
 *
 * This package provides tools for:
 * - Extracting hardcoded strings from source code
 * - Syncing translation file structures across languages
 * - Auto-translating empty strings using Google Translate
 * - Validating translation key usage in code
 * - Watching for file changes and extracting automatically
 *
 * @example
 * ```typescript
 * import { extract, sync, translate } from 'i18next-toolkit';
 *
 * // Extract Russian strings from code
 * await extract({ mode: 'extract' });
 *
 * // Sync translation files
 * await sync({ languages: ['ru', 'en', 'kk'] });
 *
 * // Auto-translate empty strings
 * await translate({ from: 'ru', to: ['en', 'kk'] });
 * ```
 *
 * @packageDocumentation
 */

// Commands
export { extract } from './commands/extract.js';
export { findMissing } from './commands/find-missing.js';
export { sync } from './commands/sync.js';
export { translate } from './commands/translate.js';
export { update } from './commands/update.js';
export { watch, watchCommand } from './commands/watch.js';
export { diff } from './commands/diff.js';
export { stats } from './commands/stats.js';
export { clean } from './commands/clean.js';
export { sort } from './commands/sort.js';
export { validate } from './commands/validate.js';
export { completion } from './commands/completion.js';

// Types
export type {
  LocaleSyncConfig,
  ExtractOptions,
  ExtractResult,
  FoundString,
  FindMissingOptions,
  FindMissingResult,
  MissingKey,
  SyncOptions,
  SyncResult,
  TranslateOptions,
  TranslateResult,
  UpdateOptions,
  UpdateResult,
  TranslationJson,
} from './types/index.js';

// Core utilities - JSON
export {
  deepMerge,
  collectAllKeys,
  fillFromSource,
  createEmptyTemplate,
  sortKeys,
  countKeys,
  countFilled,
  getNestedValue,
  setNestedValue,
  flattenKeys,
  getEmptyStrings,
} from './core/json-utils.js';

// Core utilities - Transliteration
export {
  transliterate,
  generateKey,
  hasRussian,
  matchesSourcePattern,
} from './core/transliterate.js';

// Core utilities - Translation
export {
  translateSingle,
  translateBatch,
  translateWithConcurrency,
  TranslationError,
} from './core/translator.js';
export type {
  RetryConfig,
  RateLimitConfig,
  TranslateWithConcurrencyOptions,
} from './core/translator.js';

// Core utilities - Cache
export { TranslationCache, createCache } from './core/cache.js';

// Core utilities - Config
export {
  loadConfig,
  mergeWithCliOptions,
  createConfigTemplate,
  validateConfig,
  DEFAULT_CONFIG,
} from './core/config.js';
export type { ToolkitConfig } from './core/config.js';

// Core utilities - Parser
export { parseCode } from './core/parser.js';

// Core utilities - Output
export {
  colors,
  output,
  createProgressBar,
  createMultiProgress,
  Spinner,
  Table,
  formatPercent,
  formatSize,
  formatDuration,
} from './core/output.js';

// Types - New commands
export type { DiffResult, DiffOptions } from './commands/diff.js';
export type { StatsResult, StatsOptions, LanguageStats } from './commands/stats.js';
export type { CleanResult, CleanOptions } from './commands/clean.js';
export type { SortResult, SortOptions } from './commands/sort.js';
export type { ValidateResult, ValidateOptions, ValidationIssue, IssueType } from './commands/validate.js';
