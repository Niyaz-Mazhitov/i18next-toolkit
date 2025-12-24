export interface LocaleSyncConfig {
  /** Path to locales directory (e.g., 'public/locales') */
  localesPath: string;
  /** Source language code (e.g., 'ru') */
  sourceLanguage: string;
  /** Target languages to sync/translate to */
  targetLanguages: string[];
  /** Glob pattern for source files */
  include: string;
  /** Glob patterns to ignore */
  ignore: string[];
  /** Translation function name (default: 't') */
  translationFunction: string;
  /** Function calls to skip when extracting */
  skipCallee: string[];
  /** JSX attributes to skip when extracting */
  skipJsxAttributes: string[];
}

export interface ExtractOptions {
  /** Root directory of the project */
  root?: string;
  /** Mode: 'report' | 'extract' | 'validate' */
  mode?: 'report' | 'extract' | 'validate';
  /** Don't save changes */
  dryRun?: boolean;
  /** Process only this file */
  file?: string;
  /** Glob pattern for files to process */
  include?: string;
  /** Use getters for module-level constants */
  autoGetters?: boolean;
  /** Path to locales directory */
  localesPath?: string;
  /** Category prefix for extracted keys */
  category?: string;
}

export interface ExtractResult {
  /** Found strings */
  found: FoundString[];
  /** Modified files */
  modifiedFiles: string[];
  /** Extracted translations */
  translations: Record<string, string>;
}

export interface FoundString {
  file: string;
  line: number;
  text: string;
  key: string;
  type: 'StringLiteral' | 'TemplateLiteral' | 'TemplateLiteralWithExpressions' | 'JSXText';
  interpolations?: string[];
}

export interface FindMissingOptions {
  /** Root directory of the project */
  root?: string;
  /** Path to locales directory */
  localesPath?: string;
  /** Glob pattern for files to process */
  include?: string;
  /** Source language for translation file */
  sourceLanguage?: string;
}

export interface FindMissingResult {
  /** Total keys in translation file */
  totalKeysInTranslation: number;
  /** Total keys used in code */
  totalKeysUsedInCode: number;
  /** Missing keys count */
  missingKeysCount: number;
  /** Missing keys with locations */
  missingKeys: MissingKey[];
}

export interface MissingKey {
  key: string;
  locations: { file: string; line: number }[];
}

export interface SyncOptions {
  /** Root directory of the project */
  root?: string;
  /** Path to locales directory */
  localesPath?: string;
  /** Languages to sync */
  languages?: string[];
}

export interface SyncResult {
  /** Total unique keys */
  totalKeys: number;
  /** Stats per language */
  languages: {
    code: string;
    filled: number;
    total: number;
    percent: number;
  }[];
}

export interface TranslateOptions {
  /** Root directory of the project */
  root?: string;
  /** Path to locales directory */
  localesPath?: string;
  /** Source language */
  from?: string;
  /** Target languages */
  to?: string[];
  /** Batch size for parallel requests */
  batchSize?: number;
  /** Number of concurrent requests */
  concurrency?: number;
}

export interface TranslateResult {
  /** Translations per language */
  languages: {
    code: string;
    translated: number;
  }[];
}

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
}

export interface UpdateResult {
  /** Sync result */
  sync: SyncResult;
  /** Translate result */
  translate: TranslateResult;
}

export type TranslationJson = {
  [key: string]: string | TranslationJson;
};
