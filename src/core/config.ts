/**
 * @fileoverview Configuration file loader for i18next-toolkit.
 * Supports .i18next-toolkitrc.json and package.json "i18next-toolkit" field.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Configuration options for i18next-toolkit
 */
export interface ToolkitConfig {
  /** Path to locales directory (default: 'public/locales') */
  localesPath?: string;
  /** Source language code (default: 'ru') */
  sourceLanguage?: string;
  /** Target languages to sync/translate to (default: ['en', 'kk']) */
  targetLanguages?: string[];
  /** Glob pattern for source files (default: 'src/**\/*.{ts,tsx,js,jsx}') */
  include?: string;
  /** Glob patterns to ignore */
  ignore?: string[];
  /** Category prefix for extracted keys (default: 'extracted') */
  category?: string;
  /** Batch size for translation requests (default: 50) */
  batchSize?: number;
  /** Number of concurrent translation requests (default: 5) */
  concurrency?: number;
  /** Regex pattern to match source language strings (default: Russian) */
  sourcePattern?: string;
  /** Enable translation caching (default: true) */
  cacheTranslations?: boolean;
  /** Path to translation cache file */
  cachePath?: string;
}

/** Configuration file names to search for (in order of priority) */
const CONFIG_FILES = [
  '.i18next-toolkitrc.json',
  '.i18next-toolkitrc',
  'i18next-toolkit.config.json',
];

/** Default configuration values */
export const DEFAULT_CONFIG: Required<ToolkitConfig> = {
  localesPath: 'public/locales',
  sourceLanguage: 'ru',
  targetLanguages: ['en', 'kk'],
  include: 'src/**/*.{ts,tsx,js,jsx}',
  ignore: [
    '**/node_modules/**',
    '**/*.d.ts',
    '**/*.test.*',
    '**/*.spec.*',
    '**/dist/**',
    '**/build/**',
  ],
  category: 'extracted',
  batchSize: 50,
  concurrency: 5,
  sourcePattern: '[а-яёА-ЯЁ]',
  cacheTranslations: true,
  cachePath: '.i18next-toolkit-cache.json',
};

/**
 * Find and load configuration file from the project root.
 * Searches for config files in order of priority, then falls back to package.json.
 *
 * @param root - Root directory to search from (default: process.cwd())
 * @returns Loaded configuration merged with defaults
 *
 * @example
 * ```typescript
 * const config = loadConfig();
 * console.log(config.localesPath); // 'public/locales' or custom value
 * ```
 */
export function loadConfig(root: string = process.cwd()): Required<ToolkitConfig> {
  let userConfig: ToolkitConfig = {};

  // Try to find dedicated config file
  for (const configFile of CONFIG_FILES) {
    const configPath = path.join(root, configFile);
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf8');
        userConfig = JSON.parse(content);
        break;
      } catch (error) {
        console.warn(`⚠ Could not parse ${configFile}: ${(error as Error).message}`);
      }
    }
  }

  // If no dedicated config file found, try package.json
  if (Object.keys(userConfig).length === 0) {
    const packagePath = path.join(root, 'package.json');
    if (fs.existsSync(packagePath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        if (packageJson['i18next-toolkit']) {
          userConfig = packageJson['i18next-toolkit'];
        }
      } catch (error) {
        // package.json parse error - ignore, will use defaults
      }
    }
  }

  // Merge with defaults
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    // Ensure arrays are properly merged (not replaced)
    ignore: userConfig.ignore ?? DEFAULT_CONFIG.ignore,
    targetLanguages: userConfig.targetLanguages ?? DEFAULT_CONFIG.targetLanguages,
  };
}

/**
 * Get configuration value with CLI override support.
 * CLI options take precedence over config file values.
 *
 * @param config - Loaded configuration
 * @param cliOptions - CLI options that may override config
 * @returns Merged configuration with CLI overrides
 *
 * @example
 * ```typescript
 * const config = loadConfig();
 * const finalConfig = mergeWithCliOptions(config, {
 *   localesPath: 'custom/locales'
 * });
 * ```
 */
export function mergeWithCliOptions(
  config: Required<ToolkitConfig>,
  cliOptions: Partial<ToolkitConfig>
): Required<ToolkitConfig> {
  const merged = { ...config };

  // Only override if CLI option is explicitly provided (not undefined)
  for (const [key, value] of Object.entries(cliOptions)) {
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  return merged;
}

/**
 * Create a configuration file template in the project root.
 *
 * @param root - Root directory to create config in
 * @param filename - Config filename (default: '.i18next-toolkitrc.json')
 * @returns Path to created config file
 *
 * @example
 * ```typescript
 * const configPath = createConfigTemplate();
 * console.log(`Created config at ${configPath}`);
 * ```
 */
export function createConfigTemplate(
  root: string = process.cwd(),
  filename: string = '.i18next-toolkitrc.json'
): string {
  const configPath = path.join(root, filename);

  const template: ToolkitConfig = {
    localesPath: 'public/locales',
    sourceLanguage: 'ru',
    targetLanguages: ['en', 'kk'],
    include: 'src/**/*.{ts,tsx,js,jsx}',
    category: 'extracted',
    batchSize: 50,
    concurrency: 5,
    sourcePattern: '[а-яёА-ЯЁ]',
    cacheTranslations: true,
  };

  fs.writeFileSync(configPath, JSON.stringify(template, null, 2) + '\n', 'utf8');

  return configPath;
}

/**
 * Validate configuration and return any errors found.
 *
 * @param config - Configuration to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateConfig(config: ToolkitConfig): string[] {
  const errors: string[] = [];

  if (config.sourceLanguage && !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(config.sourceLanguage)) {
    errors.push(`Invalid sourceLanguage: "${config.sourceLanguage}". Expected format: "en" or "en-US"`);
  }

  if (config.targetLanguages) {
    for (const lang of config.targetLanguages) {
      if (!/^[a-z]{2,3}(-[A-Z]{2})?$/.test(lang)) {
        errors.push(`Invalid target language: "${lang}". Expected format: "en" or "en-US"`);
      }
    }
  }

  if (config.batchSize !== undefined && (config.batchSize < 1 || config.batchSize > 100)) {
    errors.push(`Invalid batchSize: ${config.batchSize}. Must be between 1 and 100`);
  }

  if (config.concurrency !== undefined && (config.concurrency < 1 || config.concurrency > 20)) {
    errors.push(`Invalid concurrency: ${config.concurrency}. Must be between 1 and 20`);
  }

  if (config.sourcePattern) {
    try {
      new RegExp(config.sourcePattern);
    } catch {
      errors.push(`Invalid sourcePattern: "${config.sourcePattern}". Must be a valid regex`);
    }
  }

  return errors;
}
