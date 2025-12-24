// Commands
export { extract } from './commands/extract.js';
export { findMissing } from './commands/find-missing.js';
export { sync } from './commands/sync.js';
export { translate } from './commands/translate.js';
export { update } from './commands/update.js';

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

// Core utilities
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

export { transliterate, generateKey, hasRussian } from './core/transliterate.js';

export {
  translateSingle,
  translateBatch,
  translateWithConcurrency,
} from './core/translator.js';

export { parseCode } from './core/parser.js';
