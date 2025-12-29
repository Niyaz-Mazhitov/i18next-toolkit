/**
 * @fileoverview Utilities for working with i18next translation JSON files.
 * Provides functions for merging, comparing, and manipulating nested translation objects.
 */

import type { TranslationJson } from '../types/index.js';

/**
 * Deep merge two translation objects.
 * Target values are preserved; source values are only added for missing keys.
 *
 * @param target - The target object to merge into
 * @param source - The source object to merge from
 * @returns A new merged object
 *
 * @example
 * ```typescript
 * const target = { common: { hello: 'Привет' } };
 * const source = { common: { hello: 'Hi', bye: 'Bye' } };
 * deepMerge(target, source);
 * // Returns: { common: { hello: 'Привет', bye: 'Bye' } }
 * ```
 */
export function deepMerge(target: TranslationJson, source: TranslationJson): TranslationJson {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      result[key] = deepMerge((result[key] as TranslationJson) || {}, sourceValue);
    } else if (!(key in result)) {
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Collect and merge all unique keys from multiple translation objects.
 * Creates a unified structure containing all keys from all input objects.
 *
 * @param objects - Array of translation objects to merge
 * @returns A merged object with all unique keys
 *
 * @example
 * ```typescript
 * const ru = { common: { hello: 'Привет' } };
 * const en = { common: { bye: 'Bye' } };
 * collectAllKeys([ru, en]);
 * // Returns: { common: { hello: 'Привет', bye: 'Bye' } }
 * ```
 */
export function collectAllKeys(objects: TranslationJson[]): TranslationJson {
  let merged: TranslationJson = {};

  for (const obj of objects) {
    merged = deepMerge(merged, obj);
  }

  return merged;
}

/**
 * Fill template structure with values from source object.
 * Preserves template structure while copying values from source.
 *
 * @param template - The template defining the structure
 * @param source - The source object containing values
 * @returns A new object with template structure and source values
 *
 * @example
 * ```typescript
 * const template = { common: { hello: '', bye: '' } };
 * const source = { common: { hello: 'Привет' } };
 * fillFromSource(template, source);
 * // Returns: { common: { hello: 'Привет', bye: '' } }
 * ```
 */
export function fillFromSource(
  template: TranslationJson,
  source: TranslationJson
): TranslationJson {
  const result: TranslationJson = {};

  for (const key of Object.keys(template)) {
    const templateValue = template[key];
    const sourceValue = source?.[key];

    if (templateValue && typeof templateValue === 'object' && !Array.isArray(templateValue)) {
      result[key] = fillFromSource(templateValue, (sourceValue as TranslationJson) || {});
    } else {
      result[key] = (sourceValue as string) ?? (templateValue as string) ?? '';
    }
  }

  return result;
}

/**
 * Create empty template from structure, preserving existing translations.
 * New keys get empty strings; existing keys keep their values.
 *
 * @param template - The template defining the structure
 * @param source - Existing translations to preserve
 * @returns A new object with template structure
 *
 * @example
 * ```typescript
 * const template = { common: { hello: '', bye: '', new: '' } };
 * const source = { common: { hello: 'Hello' } };
 * createEmptyTemplate(template, source);
 * // Returns: { common: { hello: 'Hello', bye: '', new: '' } }
 * ```
 */
export function createEmptyTemplate(
  template: TranslationJson,
  source: TranslationJson
): TranslationJson {
  const result: TranslationJson = {};

  for (const key of Object.keys(template)) {
    const templateValue = template[key];
    const sourceValue = source?.[key];

    if (templateValue && typeof templateValue === 'object' && !Array.isArray(templateValue)) {
      result[key] = createEmptyTemplate(templateValue, (sourceValue as TranslationJson) || {});
    } else {
      result[key] = (sourceValue as string) ?? '';
    }
  }

  return result;
}

/**
 * Sort object keys alphabetically (recursive).
 * Useful for maintaining consistent ordering in translation files.
 *
 * @param obj - The object to sort
 * @returns A new object with sorted keys
 *
 * @example
 * ```typescript
 * const obj = { zebra: '1', apple: '2', banana: { z: '3', a: '4' } };
 * sortKeys(obj);
 * // Returns: { apple: '2', banana: { a: '4', z: '3' }, zebra: '1' }
 * ```
 */
export function sortKeys(obj: TranslationJson): TranslationJson {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return obj;
  }

  const sorted: TranslationJson = {};

  for (const key of Object.keys(obj).sort()) {
    const value = obj[key];
    sorted[key] = typeof value === 'object' ? sortKeys(value as TranslationJson) : value;
  }

  return sorted;
}

/**
 * Count total number of translation keys (leaf nodes) in object.
 *
 * @param obj - The translation object
 * @returns Total count of translation keys
 *
 * @example
 * ```typescript
 * const obj = { common: { hello: 'Hi', bye: 'Bye' }, errors: { e1: 'Error' } };
 * countKeys(obj); // Returns: 3
 * ```
 */
export function countKeys(obj: TranslationJson): number {
  let count = 0;

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      count += countKeys(value);
    } else {
      count++;
    }
  }

  return count;
}

/**
 * Count filled (non-empty string) translation keys.
 *
 * @param obj - The translation object
 * @returns Count of non-empty translation values
 *
 * @example
 * ```typescript
 * const obj = { common: { hello: 'Hi', bye: '' } };
 * countFilled(obj); // Returns: 1
 * ```
 */
export function countFilled(obj: TranslationJson): number {
  let count = 0;

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      count += countFilled(value);
    } else if (typeof value === 'string' && value.trim() !== '') {
      count++;
    }
  }

  return count;
}

/**
 * Get value by nested key path using dot notation.
 *
 * @param obj - The translation object
 * @param key - Dot-notation key path (e.g., 'common.hello')
 * @returns The string value or undefined if not found
 *
 * @example
 * ```typescript
 * const obj = { common: { hello: 'Hi' } };
 * getNestedValue(obj, 'common.hello'); // Returns: 'Hi'
 * getNestedValue(obj, 'common.bye');   // Returns: undefined
 * ```
 */
export function getNestedValue(obj: TranslationJson, key: string): string | undefined {
  const parts = key.split('.');
  let current: TranslationJson | string | undefined = obj;

  for (const part of parts) {
    if (current === undefined || current === null || typeof current === 'string') {
      return undefined;
    }
    current = current[part];
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Set value by nested key path using dot notation.
 * Creates intermediate objects as needed.
 *
 * @param obj - The translation object to modify
 * @param path - Dot-notation key path (e.g., 'common.hello')
 * @param value - The value to set
 *
 * @example
 * ```typescript
 * const obj = {};
 * setNestedValue(obj, 'common.hello', 'Hi');
 * // obj is now: { common: { hello: 'Hi' } }
 * ```
 */
export function setNestedValue(obj: TranslationJson, path: string, value: string): void {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] === 'string') {
      current[key] = {};
    }
    current = current[key] as TranslationJson;
  }

  current[keys[keys.length - 1]] = value;
}

/**
 * Flatten nested object to dot-notation keys.
 *
 * @param obj - The translation object
 * @param prefix - Key prefix for recursion (internal use)
 * @returns Map of dot-notation keys to values
 *
 * @example
 * ```typescript
 * const obj = { common: { hello: 'Hi', bye: 'Bye' } };
 * flattenKeys(obj);
 * // Returns Map: { 'common.hello' => 'Hi', 'common.bye' => 'Bye' }
 * ```
 */
export function flattenKeys(obj: TranslationJson, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of flattenKeys(value, fullKey)) {
        result.set(k, v);
      }
    } else if (typeof value === 'string') {
      result.set(fullKey, value);
    }
  }

  return result;
}

/**
 * Find all empty strings that have corresponding source values.
 * Used to identify strings that need translation.
 *
 * @param obj - The target translation object
 * @param sourceObj - The source translation object
 * @param prefix - Key prefix for recursion (internal use)
 * @returns Array of keys with empty target values and non-empty source values
 *
 * @example
 * ```typescript
 * const target = { common: { hello: '', bye: 'Пока' } };
 * const source = { common: { hello: 'Привет', bye: 'Пока' } };
 * getEmptyStrings(target, source);
 * // Returns: [{ key: 'common.hello', sourceValue: 'Привет' }]
 * ```
 */
export function getEmptyStrings(
  obj: TranslationJson,
  sourceObj: TranslationJson,
  prefix = ''
): { key: string; sourceValue: string }[] {
  const result: { key: string; sourceValue: string }[] = [];

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    const sourceValue = sourceObj?.[key];

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result.push(
        ...getEmptyStrings(value, (sourceValue as TranslationJson) || {}, fullKey)
      );
    } else if (
      value === '' &&
      sourceValue &&
      typeof sourceValue === 'string' &&
      sourceValue !== ''
    ) {
      result.push({ key: fullKey, sourceValue });
    }
  }

  return result;
}
