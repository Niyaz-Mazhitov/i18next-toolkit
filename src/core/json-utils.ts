import type { TranslationJson } from '../types/index.js';

/**
 * Deep merge two objects
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
 * Collect all unique keys from multiple translation objects
 */
export function collectAllKeys(objects: TranslationJson[]): TranslationJson {
  let merged: TranslationJson = {};

  for (const obj of objects) {
    merged = deepMerge(merged, obj);
  }

  return merged;
}

/**
 * Fill empty values from source object
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
 * Create empty template from structure (for translation)
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
 * Sort object keys recursively
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
 * Count total keys in translation object
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
 * Count filled (non-empty) keys
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
 * Get value by nested key path (e.g., 'a.b.c')
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
 * Set value by nested key path
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
 * Flatten nested object to dot-notation keys
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
 * Get all empty strings with their paths and source values
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
