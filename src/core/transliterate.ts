/**
 * @fileoverview Transliteration utilities for converting Russian text to Latin.
 * Used for generating translation keys from Russian strings.
 */

/**
 * Map of Russian Cyrillic characters to their Latin equivalents.
 * Follows common transliteration standards.
 */
const TRANSLIT_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

/**
 * Transliterate Russian text to Latin characters.
 * Converts each Cyrillic character to its Latin equivalent.
 *
 * @param str - The Russian string to transliterate
 * @returns The transliterated string in lowercase Latin characters
 *
 * @example
 * ```typescript
 * transliterate('Привет мир'); // 'privet mir'
 * transliterate('Ёжик');       // 'yozhik'
 * ```
 */
export function transliterate(str: string): string {
  return str
    .toLowerCase()
    .split('')
    .map((char) => (char in TRANSLIT_MAP ? TRANSLIT_MAP[char] : char))
    .join('');
}

/**
 * Generate a unique translation key from Russian text.
 * Creates a snake_case key by transliterating the text and taking first 3-4 words.
 *
 * @param text - The Russian text to generate a key from
 * @param category - Category prefix for the key (e.g., 'common', 'errors')
 * @param usedKeys - Set of already used keys to ensure uniqueness
 * @param translations - Map of existing translations for duplicate detection
 * @returns A unique key in format 'category.transliterated_words'
 *
 * @example
 * ```typescript
 * const usedKeys = new Set<string>();
 * const translations = {};
 *
 * generateKey('Добро пожаловать', 'common', usedKeys, translations);
 * // Returns: 'common.dobro_pozhalovat'
 *
 * // If same key exists with different text:
 * generateKey('Добро пожаловать домой', 'common', usedKeys, translations);
 * // Returns: 'common.dobro_pozhalovat_domoy' or 'common.dobro_pozhalovat_1'
 * ```
 */
export function generateKey(
  text: string,
  category: string,
  usedKeys: Set<string>,
  translations: Record<string, string>
): string {
  // Clean and prepare text
  const cleaned = text
    .replace(/[^а-яёА-ЯЁa-zA-Z0-9\s]/g, '')
    .trim()
    .toLowerCase();

  // Transliterate
  const translit = transliterate(cleaned);

  // Take first 3-4 words, make snake_case
  const words = translit
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);

  let baseKey = words.join('_').substring(0, 50) || 'text';
  let fullKey = `${category}.${baseKey}`;

  // Ensure unique key
  let counter = 1;
  while (usedKeys.has(fullKey) && translations[fullKey] !== text) {
    fullKey = `${category}.${baseKey}_${counter}`;
    counter++;
  }

  usedKeys.add(fullKey);
  return fullKey;
}

/** Default pattern for Russian characters */
const DEFAULT_SOURCE_PATTERN = '[а-яёА-ЯЁ]';

/**
 * Check if string contains Russian characters
 * @param str - String to check
 * @returns True if string contains Russian characters
 */
export function hasRussian(str: string): boolean {
  return typeof str === 'string' && /[а-яёА-ЯЁ]/.test(str);
}

/**
 * Check if string matches the given pattern (for source language detection)
 * @param str - String to check
 * @param pattern - Regex pattern to match (default: Russian characters)
 * @returns True if string matches the pattern
 *
 * @example
 * ```typescript
 * // Check for Russian
 * matchesSourcePattern('Привет', '[а-яёА-ЯЁ]'); // true
 *
 * // Check for Chinese
 * matchesSourcePattern('你好', '[\\u4e00-\\u9fff]'); // true
 *
 * // Check for Arabic
 * matchesSourcePattern('مرحبا', '[\\u0600-\\u06FF]'); // true
 * ```
 */
export function matchesSourcePattern(str: string, pattern: string = DEFAULT_SOURCE_PATTERN): boolean {
  if (typeof str !== 'string') return false;
  try {
    const regex = new RegExp(pattern);
    return regex.test(str);
  } catch {
    // Invalid regex, fall back to Russian pattern
    return hasRussian(str);
  }
}
