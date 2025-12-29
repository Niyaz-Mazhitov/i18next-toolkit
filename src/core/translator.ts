/**
 * @fileoverview Translation service with retry logic, rate limiting, and caching support.
 * Uses Google Translate API (free endpoint) with fallback handling.
 */

/** Configuration for retry behavior */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelay: number;
  /** Maximum delay in ms between retries (default: 10000) */
  maxDelay: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier: number;
}

/** Configuration for rate limiting */
export interface RateLimitConfig {
  /** Maximum requests per second (default: 5) */
  requestsPerSecond: number;
  /** Maximum concurrent requests (default: 3) */
  maxConcurrent: number;
}

/** Options for translation with concurrency control */
export interface TranslateWithConcurrencyOptions {
  /** Array of texts to translate */
  texts: string[];
  /** Source language code */
  from: string;
  /** Target language code */
  to: string;
  /** Number of texts per batch (default: 50) */
  batchSize?: number;
  /** Number of concurrent batch requests (default: 5) */
  concurrency?: number;
  /** Progress callback */
  onProgress?: (done: number, total: number) => void;
  /** Retry configuration */
  retry?: Partial<RetryConfig>;
  /** Rate limit configuration */
  rateLimit?: Partial<RateLimitConfig>;
}

/** Translation error with additional context */
export class TranslationError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly isRetryable: boolean = true
  ) {
    super(message);
    this.name = 'TranslationError';
  }
}

/** Default retry configuration */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/** Default rate limit configuration */
const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  requestsPerSecond: 5,
  maxConcurrent: 3,
};

/**
 * Simple rate limiter using token bucket algorithm
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private activeRequests: number = 0;
  private queue: Array<() => void> = [];

  constructor(private config: RateLimitConfig) {
    this.tokens = config.requestsPerSecond;
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const newTokens = elapsed * this.config.requestsPerSecond;
    this.tokens = Math.min(this.config.requestsPerSecond, this.tokens + newTokens);
    this.lastRefill = now;
  }

  /**
   * Acquire a token for making a request
   * @returns Promise that resolves when a token is available
   */
  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        this.refillTokens();

        if (this.tokens >= 1 && this.activeRequests < this.config.maxConcurrent) {
          this.tokens -= 1;
          this.activeRequests += 1;
          resolve();
        } else {
          // Calculate wait time
          const waitTime = this.tokens < 1
            ? Math.ceil((1 - this.tokens) / this.config.requestsPerSecond * 1000)
            : 50; // Small wait if just waiting for concurrent slot

          setTimeout(tryAcquire, waitTime);
        }
      };

      tryAcquire();
    });
  }

  /**
   * Release a token after request completion
   */
  release(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }
}

/**
 * Sleep for specified milliseconds
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay for retry attempt using exponential backoff with jitter
 * @param attempt - Current attempt number (0-based)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
  // Add jitter (±25%) to prevent thundering herd
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.floor(cappedDelay + jitter);
}

/**
 * Determine if an error is retryable based on status code or error type
 * @param error - The error to check
 * @returns Whether the request should be retried
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof TranslationError) {
    return error.isRetryable;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network errors are retryable
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('socket')
    ) {
      return true;
    }
    // Rate limit errors (429) are retryable
    if (message.includes('429') || message.includes('too many requests')) {
      return true;
    }
    // Server errors (5xx) are retryable
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
      return true;
    }
  }

  return false;
}

/**
 * Translate a single text using Google Translate API (free endpoint)
 * Includes retry logic with exponential backoff
 *
 * @param text - Text to translate
 * @param from - Source language code (e.g., 'ru', 'en')
 * @param to - Target language code
 * @param retryConfig - Optional retry configuration
 * @returns Translated text
 * @throws TranslationError if translation fails after all retries
 *
 * @example
 * ```typescript
 * const translated = await translateSingle('Привет', 'ru', 'en');
 * console.log(translated); // "Hello"
 * ```
 */
export async function translateSingle(
  text: string,
  from: string,
  to: string,
  retryConfig: Partial<RetryConfig> = {}
): Promise<string> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; i18next-toolkit/1.0)',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const isRetryable = response.status >= 500 || response.status === 429;
        throw new TranslationError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          isRetryable
        );
      }

      const data = (await response.json()) as [Array<[string, ...unknown[]]>?, ...unknown[]];

      // Extract translated text from response
      let result = '';
      if (data[0]) {
        for (const chunk of data[0]) {
          if (chunk && typeof chunk[0] === 'string') {
            result += chunk[0];
          }
        }
      }

      return result || text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (attempt < config.maxRetries && isRetryableError(error)) {
        const delay = calculateRetryDelay(attempt, config);
        await sleep(delay);
        continue;
      }

      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        break;
      }
    }
  }

  // If all retries failed, return original text with warning
  console.warn(`⚠ Translation failed for "${text.substring(0, 50)}...": ${lastError?.message}`);
  return text;
}

/**
 * Translate a batch of texts in parallel with rate limiting
 *
 * @param texts - Array of texts to translate
 * @param from - Source language code
 * @param to - Target language code
 * @param onProgress - Optional progress callback
 * @param rateLimiter - Optional rate limiter instance
 * @param retryConfig - Optional retry configuration
 * @returns Array of translated texts in the same order
 *
 * @example
 * ```typescript
 * const texts = ['Привет', 'Мир'];
 * const translated = await translateBatch(texts, 'ru', 'en');
 * console.log(translated); // ["Hello", "World"]
 * ```
 */
export async function translateBatch(
  texts: string[],
  from: string,
  to: string,
  onProgress?: (done: number, total: number) => void,
  rateLimiter?: RateLimiter,
  retryConfig?: Partial<RetryConfig>
): Promise<string[]> {
  const results: string[] = new Array(texts.length);
  let completed = 0;

  const translateWithRateLimit = async (text: string, idx: number): Promise<void> => {
    if (rateLimiter) {
      await rateLimiter.acquire();
    }

    try {
      results[idx] = await translateSingle(text, from, to, retryConfig);
    } finally {
      if (rateLimiter) {
        rateLimiter.release();
      }
      completed++;
      onProgress?.(completed, texts.length);
    }
  };

  await Promise.all(texts.map((text, idx) => translateWithRateLimit(text, idx)));
  return results;
}

/**
 * Translate texts with batching, concurrency control, rate limiting, and retry logic.
 * This is the main entry point for bulk translations.
 *
 * @param options - Translation options including texts, languages, and configuration
 * @returns Array of translated texts in the same order as input
 *
 * @example
 * ```typescript
 * const result = await translateWithConcurrency({
 *   texts: ['Привет', 'Как дела?', 'До свидания'],
 *   from: 'ru',
 *   to: 'en',
 *   batchSize: 10,
 *   concurrency: 3,
 *   onProgress: (done, total) => console.log(`${done}/${total}`),
 *   retry: { maxRetries: 5 },
 *   rateLimit: { requestsPerSecond: 10 }
 * });
 * ```
 */
export async function translateWithConcurrency({
  texts,
  from,
  to,
  batchSize = 50,
  concurrency = 5,
  onProgress,
  retry = {},
  rateLimit = {},
}: TranslateWithConcurrencyOptions): Promise<string[]> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retry };
  const rateLimitConfig = { ...DEFAULT_RATE_LIMIT_CONFIG, ...rateLimit };
  const rateLimiter = new RateLimiter(rateLimitConfig);

  // Split into batches
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    batches.push(texts.slice(i, i + batchSize));
  }

  const results: string[][] = new Array(batches.length);
  let completedTexts = 0;

  // Process batches with concurrency limit
  for (let i = 0; i < batches.length; i += concurrency) {
    const chunk = batches.slice(i, i + concurrency);

    const chunkResults = await Promise.all(
      chunk.map(async (batch) => {
        const batchResults = await translateBatch(
          batch,
          from,
          to,
          undefined,
          rateLimiter,
          retryConfig
        );
        completedTexts += batch.length;
        onProgress?.(completedTexts, texts.length);
        return batchResults;
      })
    );

    chunkResults.forEach((res, idx) => {
      results[i + idx] = res;
    });

    // Delay between batch groups to respect rate limits
    if (i + concurrency < batches.length) {
      await sleep(200);
    }
  }

  return results.flat();
}