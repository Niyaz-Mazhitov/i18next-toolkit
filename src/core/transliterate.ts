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
 * Transliterate Russian text to Latin
 */
export function transliterate(str: string): string {
  return str
    .toLowerCase()
    .split('')
    .map((char) => (char in TRANSLIT_MAP ? TRANSLIT_MAP[char] : char))
    .join('');
}

/**
 * Generate a unique key from Russian text
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

/**
 * Check if string contains Russian characters
 */
export function hasRussian(str: string): boolean {
  return typeof str === 'string' && /[а-яёА-ЯЁ]/.test(str);
}
