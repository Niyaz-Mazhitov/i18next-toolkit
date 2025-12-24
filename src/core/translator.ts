/**
 * Translate a single text using Google Translate API (free)
 */
export async function translateSingle(
  text: string,
  from: string,
  to: string
): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = (await response.json()) as [Array<[string, ...unknown[]]>?, ...unknown[]];

  // data[0] contains array of translation chunks
  let result = '';
  if (data[0]) {
    for (const chunk of data[0]) {
      if (chunk && typeof chunk[0] === 'string') {
        result += chunk[0];
      }
    }
  }

  return result || text;
}

/**
 * Translate a batch of texts in parallel
 */
export async function translateBatch(
  texts: string[],
  from: string,
  to: string,
  onProgress?: (done: number, total: number) => void
): Promise<string[]> {
  const results: string[] = [];
  let completed = 0;

  const promises = texts.map(async (text, idx) => {
    try {
      const translated = await translateSingle(text, from, to);
      results[idx] = translated;
    } catch {
      // Fallback to original text on error
      results[idx] = text;
    } finally {
      completed++;
      onProgress?.(completed, texts.length);
    }
  });

  await Promise.all(promises);
  return results;
}

interface TranslateWithConcurrencyOptions {
  texts: string[];
  from: string;
  to: string;
  batchSize?: number;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Translate texts with batching and concurrency control
 */
export async function translateWithConcurrency({
  texts,
  from,
  to,
  batchSize = 50,
  concurrency = 5,
  onProgress,
}: TranslateWithConcurrencyOptions): Promise<string[]> {
  const batches: string[][] = [];

  // Split into batches
  for (let i = 0; i < texts.length; i += batchSize) {
    batches.push(texts.slice(i, i + batchSize));
  }

  const results: string[][] = new Array(batches.length);
  let completedTexts = 0;

  // Process batches with concurrency limit
  for (let i = 0; i < batches.length; i += concurrency) {
    const chunk = batches.slice(i, i + concurrency);

    const chunkResults = await Promise.all(
      chunk.map(async (batch, idx) => {
        const batchResults = await translateBatch(batch, from, to);
        completedTexts += batch.length;
        onProgress?.(completedTexts, texts.length);
        return batchResults;
      })
    );

    chunkResults.forEach((res, idx) => {
      results[i + idx] = res;
    });

    // Small delay between groups of parallel requests
    if (i + concurrency < batches.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return results.flat();
}
