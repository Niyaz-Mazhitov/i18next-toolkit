/**
 * @fileoverview Watch mode for automatic extraction of strings on file changes.
 * Uses native fs.watch for file system monitoring.
 */

import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import { extract } from './extract.js';
import { DEFAULT_IGNORE_PATTERNS, DEFAULT_INCLUDE_PATTERN } from '../core/parser.js';

/**
 * Watch options
 */
export interface WatchOptions {
  /** Root directory of the project */
  root?: string;
  /** Glob pattern for files to watch */
  include?: string;
  /** Path to locales directory */
  localesPath?: string;
  /** Category prefix for extracted keys */
  category?: string;
  /** Regex pattern to match source language strings */
  sourcePattern?: string;
  /** Debounce delay in milliseconds (default: 300) */
  debounce?: number;
  /** Silent mode - minimal output */
  silent?: boolean;
}

/**
 * Debounce helper for file processing
 */
function debounceFunc(
  fn: (filePath: string) => Promise<void>,
  delay: number
): (filePath: string) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (filePath: string) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(filePath);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Watch for file changes and extract strings automatically.
 * Uses native fs.watch for efficient file system monitoring.
 *
 * @param options - Watch options
 * @returns Cleanup function to stop watching
 *
 * @example
 * ```typescript
 * const stop = await watch({
 *   include: 'src/**\/*.tsx',
 *   localesPath: 'public/locales',
 * });
 *
 * // Later, to stop watching:
 * stop();
 * ```
 */
export async function watch(options: WatchOptions = {}): Promise<() => void> {
  const root = options.root || process.cwd();
  const include = options.include || DEFAULT_INCLUDE_PATTERN;
  const debounceDelay = options.debounce || 300;

  console.log('👁  Watch mode started\n');
  console.log(`Pattern: ${include}`);
  console.log(`Root: ${root}`);
  console.log('\nWatching for changes... (Ctrl+C to stop)\n');

  const watchers: fs.FSWatcher[] = [];
  const watchedDirs = new Set<string>();

  // Get all matching files to determine directories to watch
  const files = await fg(include, {
    cwd: root,
    absolute: true,
    ignore: DEFAULT_IGNORE_PATTERNS,
  });

  // Collect unique directories
  for (const file of files) {
    const dir = path.dirname(file);
    watchedDirs.add(dir);
  }

  console.log(`Watching ${watchedDirs.size} directories, ${files.length} files\n`);

  // Process a changed file
  const processFile = async (filePath: string) => {
    const relPath = path.relative(root, filePath);

    // Check if file matches our pattern
    const matches = await fg(include, {
      cwd: root,
      absolute: true,
      ignore: DEFAULT_IGNORE_PATTERNS,
    });

    if (!matches.includes(filePath)) {
      return;
    }

    console.log(`\n📝 Changed: ${relPath}`);

    try {
      const result = await extract({
        root,
        mode: 'extract',
        file: filePath,
        localesPath: options.localesPath,
        category: options.category,
        sourcePattern: options.sourcePattern,
        silent: true,
      });

      if (result.found.length > 0) {
        console.log(`   ✓ Extracted ${result.found.length} strings`);
        for (const item of result.found.slice(0, 5)) {
          const shortText = item.text.length > 40 ? item.text.substring(0, 40) + '...' : item.text;
          console.log(`     - "${shortText}" → ${item.key}`);
        }
        if (result.found.length > 5) {
          console.log(`     ... and ${result.found.length - 5} more`);
        }
      } else {
        console.log('   ✓ No new strings found');
      }
    } catch (error) {
      console.error(`   ❌ Error: ${(error as Error).message}`);
    }
  };

  // Debounced file processor
  const debouncedProcess = debounceFunc(processFile, debounceDelay);

  // Watch each directory
  for (const dir of watchedDirs) {
    try {
      const watcher = fs.watch(dir, { persistent: true }, (eventType, filename) => {
        if (!filename) return;

        const filePath = path.join(dir, filename);

        // Check if file exists (might be deleted)
        if (!fs.existsSync(filePath)) return;

        // Check file extension
        const ext = path.extname(filename);
        if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) return;

        debouncedProcess(filePath);
      });

      watchers.push(watcher);
    } catch (error) {
      console.warn(`⚠ Could not watch ${dir}: ${(error as Error).message}`);
    }
  }

  // Return cleanup function
  return () => {
    console.log('\n\n👋 Stopping watch mode...');
    for (const watcher of watchers) {
      watcher.close();
    }
    console.log('✓ Stopped');
  };
}

/**
 * Run watch mode as a CLI command (blocking)
 */
export async function watchCommand(options: WatchOptions = {}): Promise<void> {
  const stop = await watch(options);

  // Handle graceful shutdown
  const shutdown = () => {
    stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep process running
  await new Promise(() => {
    // This promise never resolves, keeping the process alive
  });
}
