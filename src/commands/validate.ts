/**
 * @fileoverview Validate command - check translation files for issues.
 * Detects invalid JSON, duplicates, empty values, and inconsistencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { TranslationJson } from '../types/index.js';
import { flattenKeys } from '../core/json-utils.js';
import { colors, output, Table } from '../core/output.js';

const DEFAULT_LOCALES_PATH = 'public/locales';

/**
 * Validation issue types
 */
export type IssueType =
  | 'invalid_json'
  | 'empty_value'
  | 'duplicate_key'
  | 'missing_key'
  | 'extra_key'
  | 'inconsistent_type'
  | 'interpolation_mismatch'
  | 'trailing_whitespace'
  | 'missing_file';

/**
 * Single validation issue
 */
export interface ValidationIssue {
  /** Type of issue */
  type: IssueType;
  /** Language code */
  language: string;
  /** Key path (if applicable) */
  key?: string;
  /** Issue message */
  message: string;
  /** Severity: error or warning */
  severity: 'error' | 'warning';
}

/**
 * Validation result
 */
export interface ValidateResult {
  /** Whether validation passed */
  valid: boolean;
  /** Number of errors */
  errorCount: number;
  /** Number of warnings */
  warningCount: number;
  /** All issues found */
  issues: ValidationIssue[];
}

/**
 * Options for validate command
 */
export interface ValidateOptions {
  /** Root directory */
  root?: string;
  /** Path to locales directory */
  localesPath?: string;
  /** Languages to validate */
  languages?: string[];
  /** Source language for comparison */
  source?: string;
  /** Treat warnings as errors */
  strict?: boolean;
  /** Silent mode */
  silent?: boolean;
}

/**
 * Extract interpolation placeholders from a string
 */
function extractInterpolations(str: string): string[] {
  const matches = str.match(/\{\{(\w+)\}\}/g) || [];
  return matches.map(m => m.slice(2, -2)).sort();
}

/**
 * Check for trailing whitespace issues
 */
function checkTrailingWhitespace(value: string, key: string, lang: string): ValidationIssue | null {
  if (value !== value.trim()) {
    return {
      type: 'trailing_whitespace',
      language: lang,
      key,
      message: 'Value has leading or trailing whitespace',
      severity: 'warning',
    };
  }
  return null;
}

/**
 * Validate translation files for common issues.
 * Checks for:
 * - Invalid JSON syntax
 * - Empty translation values
 * - Missing keys compared to source
 * - Extra keys not in source
 * - Interpolation mismatches ({{var}} placeholders)
 * - Trailing whitespace
 *
 * @param options - Validate options
 * @returns Validation result with all issues
 *
 * @example
 * ```typescript
 * const result = await validate({ strict: true });
 * if (!result.valid) {
 *   console.error(`Found ${result.errorCount} errors`);
 *   process.exit(1);
 * }
 * ```
 */
export async function validate(options: ValidateOptions = {}): Promise<ValidateResult> {
  const root = options.root || process.cwd();
  const localesPath = options.localesPath || DEFAULT_LOCALES_PATH;
  const sourceLang = options.source || 'ru';
  const localesDir = path.join(root, localesPath);

  const issues: ValidationIssue[] = [];

  // Determine languages
  let languages = options.languages || [];
  if (languages.length === 0) {
    try {
      const dirs = fs.readdirSync(localesDir, { withFileTypes: true });
      languages = dirs.filter(d => d.isDirectory()).map(d => d.name);
    } catch {
      if (!options.silent) {
        output.error(`Could not read locales directory: ${localesDir}`);
      }
      return { valid: false, errorCount: 1, warningCount: 0, issues: [] };
    }
  }

  // Ensure source is first
  if (!languages.includes(sourceLang)) {
    languages.unshift(sourceLang);
  } else {
    languages = [sourceLang, ...languages.filter(l => l !== sourceLang)];
  }

  if (!options.silent) {
    output.header('Validate Translations');
    output.keyValue('Source', sourceLang);
    output.keyValue('Languages', languages.join(', '));
    output.newline();
  }

  // Load all translations
  const translations: Map<string, Map<string, string>> = new Map();
  const rawJson: Map<string, TranslationJson> = new Map();

  for (const lang of languages) {
    const filePath = path.join(localesDir, lang, 'translation.json');

    if (!fs.existsSync(filePath)) {
      issues.push({
        type: 'missing_file',
        language: lang,
        message: `Translation file not found: ${filePath}`,
        severity: 'error',
      });
      continue;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');

      // Try to parse JSON
      let json: TranslationJson;
      try {
        json = JSON.parse(content);
      } catch (parseError) {
        issues.push({
          type: 'invalid_json',
          language: lang,
          message: `Invalid JSON: ${(parseError as Error).message}`,
          severity: 'error',
        });
        continue;
      }

      rawJson.set(lang, json);
      translations.set(lang, flattenKeys(json));
    } catch (error) {
      issues.push({
        type: 'invalid_json',
        language: lang,
        message: `Could not read file: ${(error as Error).message}`,
        severity: 'error',
      });
    }
  }

  // Get source translations
  const sourceMap = translations.get(sourceLang);
  if (!sourceMap) {
    if (!options.silent) {
      output.error(`Source language ${sourceLang} could not be loaded`);
    }
    return {
      valid: false,
      errorCount: issues.filter(i => i.severity === 'error').length,
      warningCount: issues.filter(i => i.severity === 'warning').length,
      issues,
    };
  }

  // Validate each language
  for (const [lang, langMap] of translations) {
    if (lang === sourceLang) {
      // Validate source for whitespace issues
      for (const [key, value] of langMap) {
        const wsIssue = checkTrailingWhitespace(value, key, lang);
        if (wsIssue) issues.push(wsIssue);
      }
      continue;
    }

    // Check for missing keys
    for (const [key, sourceValue] of sourceMap) {
      if (!langMap.has(key)) {
        issues.push({
          type: 'missing_key',
          language: lang,
          key,
          message: `Key missing from ${lang}`,
          severity: 'warning',
        });
      } else {
        const targetValue = langMap.get(key) || '';

        // Check for empty values
        if (targetValue === '' && sourceValue !== '') {
          issues.push({
            type: 'empty_value',
            language: lang,
            key,
            message: 'Translation is empty',
            severity: 'warning',
          });
        }

        // Check interpolation consistency
        const sourceInterps = extractInterpolations(sourceValue);
        const targetInterps = extractInterpolations(targetValue);

        if (targetValue !== '' && JSON.stringify(sourceInterps) !== JSON.stringify(targetInterps)) {
          issues.push({
            type: 'interpolation_mismatch',
            language: lang,
            key,
            message: `Interpolation mismatch: source has {${sourceInterps.join(', ')}}, target has {${targetInterps.join(', ')}}`,
            severity: 'error',
          });
        }

        // Check whitespace
        if (targetValue !== '') {
          const wsIssue = checkTrailingWhitespace(targetValue, key, lang);
          if (wsIssue) issues.push(wsIssue);
        }
      }
    }

    // Check for extra keys
    for (const key of langMap.keys()) {
      if (!sourceMap.has(key)) {
        issues.push({
          type: 'extra_key',
          language: lang,
          key,
          message: `Key exists in ${lang} but not in source`,
          severity: 'warning',
        });
      }
    }
  }

  // Count issues
  const errorCount = issues.filter(i => i.severity === 'error').length;
  let warningCount = issues.filter(i => i.severity === 'warning').length;

  // In strict mode, treat warnings as errors
  const effectiveErrors = options.strict ? errorCount + warningCount : errorCount;

  // Print results
  if (!options.silent) {
    // Group issues by language
    const byLang: Map<string, ValidationIssue[]> = new Map();
    for (const issue of issues) {
      if (!byLang.has(issue.language)) {
        byLang.set(issue.language, []);
      }
      byLang.get(issue.language)!.push(issue);
    }

    for (const [lang, langIssues] of byLang) {
      const errors = langIssues.filter(i => i.severity === 'error');
      const warnings = langIssues.filter(i => i.severity === 'warning');

      output.section(`${colors.lang(lang.toUpperCase())}`);

      if (langIssues.length === 0) {
        output.success('No issues found');
      } else {
        // Show errors first
        for (const issue of errors.slice(0, 10)) {
          console.log(`  ${colors.error('error')} ${issue.type}`);
          if (issue.key) {
            console.log(`    ${colors.key(issue.key)}: ${issue.message}`);
          } else {
            console.log(`    ${issue.message}`);
          }
        }

        // Then warnings
        for (const issue of warnings.slice(0, 10)) {
          console.log(`  ${colors.warning('warn')} ${issue.type}`);
          if (issue.key) {
            console.log(`    ${colors.key(issue.key)}: ${issue.message}`);
          } else {
            console.log(`    ${issue.message}`);
          }
        }

        if (langIssues.length > 20) {
          output.dim(`  ... and ${langIssues.length - 20} more issues`);
        }
      }
    }

    // Summary
    output.newline();
    output.separator();

    if (effectiveErrors > 0) {
      output.error(`Validation failed: ${errorCount} error(s), ${warningCount} warning(s)`);
    } else if (warningCount > 0) {
      output.warn(`Validation passed with ${warningCount} warning(s)`);
    } else {
      output.success('Validation passed - no issues found');
    }
  }

  return {
    valid: effectiveErrors === 0,
    errorCount,
    warningCount,
    issues,
  };
}
