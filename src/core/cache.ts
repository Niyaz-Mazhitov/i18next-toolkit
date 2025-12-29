/**
 * @fileoverview Translation cache for avoiding redundant API calls.
 * Caches translations to disk to persist between runs.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Cache entry structure
 */
interface CacheEntry {
  /** Original text */
  source: string;
  /** Translated text */
  translation: string;
  /** Source language code */
  from: string;
  /** Target language code */
  to: string;
  /** Timestamp when cached */
  timestamp: number;
}

/**
 * Cache file structure
 */
interface CacheData {
  /** Cache version for migration support */
  version: number;
  /** Map of hash -> cache entry */
  entries: Record<string, CacheEntry>;
}

/** Current cache version */
const CACHE_VERSION = 1;

/** Default cache file path */
const DEFAULT_CACHE_PATH = '.i18next-toolkit-cache.json';

/** Cache TTL in milliseconds (30 days) */
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

/**
 * Translation cache manager
 *
 * @example
 * ```typescript
 * const cache = new TranslationCache();
 * await cache.load();
 *
 * // Check cache before translating
 * const cached = cache.get('Hello', 'en', 'ru');
 * if (cached) {
 *   console.log('From cache:', cached);
 * } else {
 *   const translated = await translateSingle('Hello', 'en', 'ru');
 *   cache.set('Hello', translated, 'en', 'ru');
 * }
 *
 * await cache.save();
 * ```
 */
export class TranslationCache {
  private data: CacheData;
  private dirty: boolean = false;
  private cachePath: string;

  /**
   * Create a new translation cache
   * @param root - Root directory for cache file
   * @param cachePath - Custom cache file path (relative to root)
   */
  constructor(root: string = process.cwd(), cachePath: string = DEFAULT_CACHE_PATH) {
    this.cachePath = path.isAbsolute(cachePath) ? cachePath : path.join(root, cachePath);
    this.data = {
      version: CACHE_VERSION,
      entries: {},
    };
  }

  /**
   * Generate a unique hash for a translation request
   */
  private generateKey(text: string, from: string, to: string): string {
    const input = `${from}:${to}:${text}`;
    return crypto.createHash('md5').update(input).digest('hex');
  }

  /**
   * Load cache from disk
   */
  async load(): Promise<void> {
    try {
      if (fs.existsSync(this.cachePath)) {
        const content = fs.readFileSync(this.cachePath, 'utf8');
        const parsed = JSON.parse(content) as CacheData;

        // Check version and migrate if needed
        if (parsed.version === CACHE_VERSION) {
          this.data = parsed;
          this.cleanup();
        } else {
          // Version mismatch - start fresh
          console.warn('⚠ Translation cache version mismatch, starting fresh');
        }
      }
    } catch (error) {
      // Cache load failed - start fresh
      console.warn(`⚠ Could not load translation cache: ${(error as Error).message}`);
    }
  }

  /**
   * Save cache to disk
   */
  async save(): Promise<void> {
    if (!this.dirty) return;

    try {
      const content = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(this.cachePath, content, 'utf8');
      this.dirty = false;
    } catch (error) {
      console.warn(`⚠ Could not save translation cache: ${(error as Error).message}`);
    }
  }

  /**
   * Get a cached translation
   * @param text - Original text
   * @param from - Source language code
   * @param to - Target language code
   * @returns Cached translation or undefined if not found
   */
  get(text: string, from: string, to: string): string | undefined {
    const key = this.generateKey(text, from, to);
    const entry = this.data.entries[key];

    if (entry && entry.source === text && entry.from === from && entry.to === to) {
      // Check if entry is still valid (not expired)
      if (Date.now() - entry.timestamp < CACHE_TTL) {
        return entry.translation;
      }
    }

    return undefined;
  }

  /**
   * Set a cached translation
   * @param text - Original text
   * @param translation - Translated text
   * @param from - Source language code
   * @param to - Target language code
   */
  set(text: string, translation: string, from: string, to: string): void {
    const key = this.generateKey(text, from, to);
    this.data.entries[key] = {
      source: text,
      translation,
      from,
      to,
      timestamp: Date.now(),
    };
    this.dirty = true;
  }

  /**
   * Check if a translation is cached
   * @param text - Original text
   * @param from - Source language code
   * @param to - Target language code
   * @returns True if cached and valid
   */
  has(text: string, from: string, to: string): boolean {
    return this.get(text, from, to) !== undefined;
  }

  /**
   * Get multiple translations from cache
   * @param texts - Array of texts to look up
   * @param from - Source language code
   * @param to - Target language code
   * @returns Object with cached and uncached texts
   */
  getMany(texts: string[], from: string, to: string): {
    cached: Map<string, string>;
    uncached: string[];
  } {
    const cached = new Map<string, string>();
    const uncached: string[] = [];

    for (const text of texts) {
      const translation = this.get(text, from, to);
      if (translation !== undefined) {
        cached.set(text, translation);
      } else {
        uncached.push(text);
      }
    }

    return { cached, uncached };
  }

  /**
   * Set multiple translations in cache
   * @param translations - Map of source text to translation
   * @param from - Source language code
   * @param to - Target language code
   */
  setMany(translations: Map<string, string>, from: string, to: string): void {
    for (const [text, translation] of translations) {
      this.set(text, translation, from, to);
    }
  }

  /**
   * Remove expired entries from cache
   */
  cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of Object.entries(this.data.entries)) {
      if (now - entry.timestamp >= CACHE_TTL) {
        delete this.data.entries[key];
        removed++;
        this.dirty = true;
      }
    }

    if (removed > 0) {
      console.log(`Cleaned up ${removed} expired cache entries`);
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.data.entries = {};
    this.dirty = true;
  }

  /**
   * Get cache statistics
   */
  stats(): { entries: number; size: number } {
    const entries = Object.keys(this.data.entries).length;
    const size = JSON.stringify(this.data).length;
    return { entries, size };
  }
}

/**
 * Create and load a translation cache
 * @param root - Root directory for cache file
 * @param cachePath - Custom cache file path
 * @returns Loaded cache instance
 */
export async function createCache(
  root: string = process.cwd(),
  cachePath: string = DEFAULT_CACHE_PATH
): Promise<TranslationCache> {
  const cache = new TranslationCache(root, cachePath);
  await cache.load();
  return cache;
}
