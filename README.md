# i18next-toolkit

i18n automation toolkit for i18next projects. Extract strings from code, sync translations across languages, and auto-translate with Google Translate.

## Installation

```bash
npm install -D i18next-toolkit
# or
yarn add -D i18next-toolkit
# or
pnpm add -D i18next-toolkit
```

## CLI Usage

### Extract Russian strings from code

Find Russian strings in your codebase and replace them with `t('key')` calls:

```bash
# Report mode - show what would be extracted
i18next-toolkit extract --mode=report

# Extract and replace strings
i18next-toolkit extract --mode=extract

# Dry run - don't save changes
i18next-toolkit extract --mode=extract --dry-run

# Process single file
i18next-toolkit extract --file=src/components/Button.tsx

# Use getters for module-level constants (solves early t() call issue)
i18next-toolkit extract --mode=extract --auto-getters

# Validate that all t() keys exist in translation file
i18next-toolkit extract --mode=validate
```

### Find missing translation keys

Find keys used in code but missing from translation file:

```bash
i18next-toolkit find-missing

# With custom paths
i18next-toolkit find-missing --locales-path=src/locales --source-language=en
```

### Sync locale structure

Ensure all language files have the same keys:

```bash
i18next-toolkit sync

# With custom languages
i18next-toolkit sync --languages=en,de,fr,es
```

### Auto-translate

Translate empty strings using Google Translate:

```bash
i18next-toolkit translate

# Custom source and targets
i18next-toolkit translate --from=en --to=de,fr,es

# Adjust performance
i18next-toolkit translate --batch-size=100 --concurrency=10
```

### Update (sync + translate in one step)

The most common workflow - sync structure and translate in one command:

```bash
# Default: sync ru/en/kk and translate
i18next-toolkit update

# Custom languages
i18next-toolkit update --source=en --target=de,fr,es

# With custom settings
i18next-toolkit update --locales-path=src/i18n --batch-size=100
```

Output example:
```
╔════════════════════════════════════════╗
║         LOCALE-SYNC UPDATE             ║
╚════════════════════════════════════════╝

Source language: ru
Target languages: en, kk
Locales path: public/locales

┌────────────────────────────────────────┐
│  Step 1/2: Syncing locale structure    │
└────────────────────────────────────────┘

...

┌────────────────────────────────────────┐
│  Step 2/2: Auto-translating strings    │
└────────────────────────────────────────┘

...

╔════════════════════════════════════════╗
║              SUMMARY                   ║
╚════════════════════════════════════════╝

Total keys: 1523
Language stats:
  RU: 1523/1523 (100%)
  EN: 1520/1523 (99%) [+15 translated]
  KK: 1518/1523 (99%) [+17 translated]

✓ Update complete!
```

## Programmatic API

```typescript
import { extract, findMissing, sync, translate, update } from 'i18next-toolkit';

// Extract Russian strings
const extractResult = await extract({
  mode: 'report', // 'report' | 'extract' | 'validate'
  include: 'src/**/*.{ts,tsx}',
  localesPath: 'public/locales',
  dryRun: false,
  autoGetters: false,
});

console.log(`Found ${extractResult.found.length} strings`);

// Find missing keys
const missingResult = await findMissing({
  include: 'src/**/*.{ts,tsx}',
  localesPath: 'public/locales',
  sourceLanguage: 'ru',
});

console.log(`Missing keys: ${missingResult.missingKeysCount}`);

// Sync locales
const syncResult = await sync({
  localesPath: 'public/locales',
  languages: ['ru', 'en', 'kk'],
});

console.log(`Total keys: ${syncResult.totalKeys}`);

// Auto-translate
const translateResult = await translate({
  localesPath: 'public/locales',
  from: 'ru',
  to: ['en', 'kk'],
  batchSize: 50,
  concurrency: 5,
});

for (const lang of translateResult.languages) {
  console.log(`${lang.code}: translated ${lang.translated} strings`);
}

// Update: sync + translate in one step
const updateResult = await update({
  localesPath: 'public/locales',
  sourceLanguage: 'ru',
  targetLanguages: ['en', 'kk'],
});

console.log(`Synced ${updateResult.sync.totalKeys} keys`);
```

## Features

### Extract command

- Finds Russian strings in TypeScript/JavaScript/JSX code
- Generates unique keys using transliteration
- Handles string literals, template literals, and JSX text
- Supports interpolations: `` `Hello, ${name}!` `` → `t('key', { name })`
- Skips console.log, Error, and other debug calls
- Skips technical JSX attributes (className, id, etc.)
- Auto-getters mode for module-level constants

### Find missing command

- Scans code for `t('key')` and `i18n.t('key')` calls
- Reports keys missing from translation file
- Groups results by namespace

### Sync command

- Ensures all language files have identical structure
- First language is treated as source (values preserved)
- Other languages get empty strings for new keys
- Sorts keys alphabetically

### Translate command

- Uses free Google Translate API
- Parallel translation with batching
- Progress reporting
- Fallback to original on errors

### Update command

- Combines sync + translate in one step
- Perfect for CI/CD pipelines
- Shows summary with statistics

## Project Structure

```
public/
  locales/
    ru/
      translation.json
    en/
      translation.json
    kk/
      translation.json
```

## Options Reference

### extract

| Option | Default | Description |
|--------|---------|-------------|
| `--mode` | `report` | Mode: report, extract, validate |
| `--dry-run` | `false` | Don't save changes |
| `--file` | - | Process single file |
| `--include` | `src/**/*.{ts,tsx,js,jsx}` | Glob pattern |
| `--locales-path` | `public/locales` | Locales directory |
| `--category` | `extracted` | Key prefix category |
| `--auto-getters` | `false` | Use getters for constants |

### find-missing

| Option | Default | Description |
|--------|---------|-------------|
| `--include` | `src/**/*.{ts,tsx,js,jsx}` | Glob pattern |
| `--locales-path` | `public/locales` | Locales directory |
| `--source-language` | `ru` | Source language code |

### sync

| Option | Default | Description |
|--------|---------|-------------|
| `--locales-path` | `public/locales` | Locales directory |
| `--languages` | `ru,en,kk` | Comma-separated languages |

### translate

| Option | Default | Description |
|--------|---------|-------------|
| `--locales-path` | `public/locales` | Locales directory |
| `--from` | `ru` | Source language |
| `--to` | `en,kk` | Target languages |
| `--batch-size` | `50` | Texts per batch |
| `--concurrency` | `5` | Parallel batches |

### update

| Option | Default | Description |
|--------|---------|-------------|
| `--locales-path` | `public/locales` | Locales directory |
| `--source` | `ru` | Source language |
| `--target` | `en,kk` | Target languages |
| `--batch-size` | `50` | Texts per batch |
| `--concurrency` | `5` | Parallel batches |

## License

MIT
