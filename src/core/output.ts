/**
 * @fileoverview Output utilities for colored console output and progress bars.
 * Provides consistent styling across all CLI commands.
 */

import pc from 'picocolors';
import cliProgress from 'cli-progress';

/**
 * Color utilities using picocolors
 */
export const colors = {
  // Status colors
  success: pc.green,
  error: pc.red,
  warning: pc.yellow,
  info: pc.blue,
  dim: pc.dim,
  bold: pc.bold,

  // Semantic colors
  key: pc.cyan,
  value: pc.white,
  path: pc.dim,
  number: pc.yellow,
  lang: pc.magenta,

  // Symbols
  symbols: {
    success: pc.green('✓'),
    error: pc.red('✗'),
    warning: pc.yellow('⚠'),
    info: pc.blue('ℹ'),
    arrow: pc.dim('→'),
    bullet: pc.dim('•'),
    folder: '📁',
    file: '📄',
    package: '📦',
    watch: '👁',
    globe: '🌍',
  },
};

/**
 * Formatted output helpers
 */
export const output = {
  /** Print success message */
  success(message: string): void {
    console.log(`${colors.symbols.success} ${colors.success(message)}`);
  },

  /** Print error message */
  error(message: string): void {
    console.error(`${colors.symbols.error} ${colors.error(message)}`);
  },

  /** Print warning message */
  warn(message: string): void {
    console.warn(`${colors.symbols.warning} ${colors.warning(message)}`);
  },

  /** Print info message */
  info(message: string): void {
    console.log(`${colors.symbols.info} ${colors.info(message)}`);
  },

  /** Print dimmed message */
  dim(message: string): void {
    console.log(colors.dim(message));
  },

  /** Print header/title */
  header(title: string): void {
    const line = '─'.repeat(Math.max(40, title.length + 4));
    console.log('');
    console.log(colors.bold(title));
    console.log(colors.dim(line));
  },

  /** Print section header */
  section(title: string): void {
    console.log('');
    console.log(colors.bold(colors.info(title)));
  },

  /** Print key-value pair */
  keyValue(key: string, value: string | number, indent = 0): void {
    const prefix = ' '.repeat(indent);
    console.log(`${prefix}${colors.dim(key + ':')} ${value}`);
  },

  /** Print list item */
  listItem(item: string, indent = 0): void {
    const prefix = ' '.repeat(indent);
    console.log(`${prefix}${colors.symbols.bullet} ${item}`);
  },

  /** Print table row */
  tableRow(columns: string[], widths: number[]): void {
    const row = columns
      .map((col, i) => col.padEnd(widths[i] || 10))
      .join(' ');
    console.log(row);
  },

  /** Print separator line */
  separator(char = '─', length = 50): void {
    console.log(colors.dim(char.repeat(length)));
  },

  /** Print empty line */
  newline(): void {
    console.log('');
  },

  /** Print box with title */
  box(title: string, content?: string[]): void {
    const width = Math.max(40, title.length + 4);
    const top = '╔' + '═'.repeat(width) + '╗';
    const bottom = '╚' + '═'.repeat(width) + '╝';
    const titleLine = '║  ' + title.padEnd(width - 2) + '║';

    console.log(colors.bold(top));
    console.log(colors.bold(titleLine));
    console.log(colors.bold(bottom));

    if (content) {
      for (const line of content) {
        console.log('  ' + line);
      }
    }
  },

  /** Print step indicator */
  step(current: number, total: number, title: string): void {
    console.log('');
    console.log(`${colors.info(`[${current}/${total}]`)} ${colors.bold(title)}`);
    console.log(colors.dim('─'.repeat(40)));
  },
};

/**
 * Progress bar configuration options
 */
export interface ProgressOptions {
  /** Total number of items */
  total: number;
  /** Format string for the bar */
  format?: string;
  /** Bar character */
  barCompleteChar?: string;
  /** Empty bar character */
  barIncompleteChar?: string;
  /** Hide cursor during progress */
  hideCursor?: boolean;
  /** Clear bar on complete */
  clearOnComplete?: boolean;
}

/**
 * Create a progress bar for CLI operations
 *
 * @example
 * ```typescript
 * const bar = createProgressBar(100);
 * bar.start();
 * for (let i = 0; i < 100; i++) {
 *   await doWork();
 *   bar.increment();
 * }
 * bar.stop();
 * ```
 */
export function createProgressBar(totalOrOptions: number | ProgressOptions): {
  start: () => void;
  increment: (step?: number) => void;
  update: (value: number) => void;
  stop: () => void;
  bar: cliProgress.SingleBar;
} {
  const options: ProgressOptions = typeof totalOrOptions === 'number'
    ? { total: totalOrOptions }
    : totalOrOptions;

  const format = options.format ||
    `${colors.info('{bar}')} ${colors.bold('{percentage}%')} | ${colors.dim('{value}/{total}')} | {duration_formatted}`;

  const bar = new cliProgress.SingleBar({
    format,
    barCompleteChar: options.barCompleteChar || '█',
    barIncompleteChar: options.barIncompleteChar || '░',
    hideCursor: options.hideCursor ?? true,
    clearOnComplete: options.clearOnComplete ?? false,
    barsize: 30,
    stopOnComplete: true,
  });

  return {
    start: () => bar.start(options.total, 0),
    increment: (step = 1) => bar.increment(step),
    update: (value: number) => bar.update(value),
    stop: () => bar.stop(),
    bar,
  };
}

/**
 * Create a multi-bar progress for parallel operations
 */
export function createMultiProgress(): cliProgress.MultiBar {
  return new cliProgress.MultiBar({
    format: `${colors.lang('{name}')} ${colors.info('{bar}')} {percentage}% | {value}/{total}`,
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true,
    clearOnComplete: false,
    barsize: 20,
  });
}

/**
 * Spinner for indeterminate operations
 */
export class Spinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private current = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private message: string;

  constructor(message: string) {
    this.message = message;
  }

  start(): void {
    process.stdout.write('\x1B[?25l'); // Hide cursor
    this.interval = setInterval(() => {
      const frame = colors.info(this.frames[this.current]);
      process.stdout.write(`\r${frame} ${this.message}`);
      this.current = (this.current + 1) % this.frames.length;
    }, 80);
  }

  stop(finalMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write('\r\x1B[K'); // Clear line
    process.stdout.write('\x1B[?25h'); // Show cursor
    if (finalMessage) {
      console.log(finalMessage);
    }
  }

  succeed(message?: string): void {
    this.stop(`${colors.symbols.success} ${message || this.message}`);
  }

  fail(message?: string): void {
    this.stop(`${colors.symbols.error} ${message || this.message}`);
  }
}

/**
 * Format percentage with color based on value
 * @param value - Either the percent value (0-100) or the numerator
 * @param total - Optional total for calculating percentage
 */
export function formatPercent(value: number, total?: number): string {
  const percent = total !== undefined ? (total > 0 ? Math.round((value / total) * 100) : 0) : value;
  const formatted = `${percent}%`;

  if (percent === 100) return colors.success(formatted);
  if (percent >= 80) return colors.info(formatted);
  if (percent >= 50) return colors.warning(formatted);
  return colors.error(formatted);
}

/**
 * Format file size in human readable format
 */
export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format duration in human readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Table renderer for aligned output
 */
export class Table {
  private rows: string[][] = [];
  private headers: string[] = [];
  private widths: number[] = [];

  constructor(headers?: string[]) {
    if (headers) {
      this.headers = headers;
      this.widths = headers.map(h => h.length);
    }
  }

  addRow(columns: (string | number)[]): void {
    const row = columns.map(c => String(c));
    this.rows.push(row);

    // Update column widths
    row.forEach((col, i) => {
      const len = col.replace(/\x1b\[[0-9;]*m/g, '').length; // Strip ANSI codes
      this.widths[i] = Math.max(this.widths[i] || 0, len);
    });
  }

  print(): void {
    // Print headers
    if (this.headers.length > 0) {
      const headerRow = this.headers
        .map((h, i) => colors.bold(h.padEnd(this.widths[i])))
        .join('  ');
      console.log(headerRow);
      console.log(colors.dim('─'.repeat(this.widths.reduce((a, b) => a + b, 0) + (this.widths.length - 1) * 2)));
    }

    // Print rows
    for (const row of this.rows) {
      const formattedRow = row
        .map((col, i) => {
          const stripped = col.replace(/\x1b\[[0-9;]*m/g, '');
          const padding = this.widths[i] - stripped.length;
          return col + ' '.repeat(Math.max(0, padding));
        })
        .join('  ');
      console.log(formattedRow);
    }
  }
}
