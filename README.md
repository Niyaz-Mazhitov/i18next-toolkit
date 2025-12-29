# i18next-toolkit

i18n automation toolkit for i18next projects. Extract strings from code, sync translations across languages, and auto-translate with Google Translate.

## Features

- **Extract** - Find hardcoded strings and replace with `t()` calls
- **Sync** - Ensure all language files have identical structure
- **Translate** - Auto-translate empty strings via Google Translate
- **Watch** - Automatically extract strings on file changes
- **Diff** - Compare translations between languages
- **Stats** - View translation coverage statistics
- **Clean** - Remove unused translation keys
- **Sort** - Alphabetically sort translation keys
- **Validate** - Check for translation issues
- **Caching** - Cache translations to avoid redundant API calls
- **Configurable** - Support for config files and custom patterns
- **Shell Completion** - Tab completion for bash, zsh, and fish

## Installation

```bash
npm install -D i18next-toolkit
# or
yarn add -D i18next-toolkit
# or
pnpm add -D i18next-toolkit
```

## Quick Start

```bash
# Initialize configuration file
i18next-toolkit init

# Extract strings from code (report mode)
i18next-toolkit extract

# Sync + translate in one command
i18next-toolkit update

# Watch for changes
i18next-toolkit watch
```

## Configuration

Create a config file to customize default options:

```bash
i18next-toolkit init
```

This creates `.i18next-toolkitrc.json`:

```json
{
  "localesPath": "public/locales",
  "sourceLanguage": "ru",
  "targetLanguages": ["en", "kk"],
  "include": "src/**/*.{ts,tsx,js,jsx}",
  "category": "extracted",
  "batchSize": 50,
  "concurrency": 5,
  "sourcePattern": "[а-яёА-ЯЁ]",
  "cacheTranslations": true
}
```

Alternatively, add to `package.json`:

```json
{
  "i18next-toolkit": {
    "localesPath": "src/locales",
    "sourceLanguage": "en",
    "targetLanguages": ["de", "fr", "es"]
  }
}
```

## CLI Usage

### Extract strings from code

Find strings matching source pattern and replace with `t('key')` calls:

```bash
# Report mode - show what would be extracted
i18next-toolkit extract --mode=report

# Extract and replace strings
i18next-toolkit extract --mode=extract

# Dry run - don't save changes
i18next-toolkit extract --mode=extract --dry-run

# Process single file
i18next-toolkit extract --file=src/components/Button.tsx

# Use getters for module-level constants
i18next-toolkit extract --mode=extract --auto-getters

# Validate that all t() keys exist in translation file
i18next-toolkit extract --mode=validate

# Custom source pattern (e.g., Chinese characters)
i18next-toolkit extract --source-pattern="[\u4e00-\u9fff]"
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

### Update (sync + translate)

The most common workflow - sync structure and translate in one command:

```bash
# Default: sync and translate
i18next-toolkit update

# Custom languages
i18next-toolkit update --source=en --target=de,fr,es

# With custom settings
i18next-toolkit update --locales-path=src/i18n --batch-size=100
```

### Watch mode

Automatically extract strings when files change:

```bash
# Start watching
i18next-toolkit watch

# With custom settings
i18next-toolkit watch --include="src/**/*.tsx" --category=ui

# Custom debounce delay
i18next-toolkit watch --debounce=500
```

### Compare languages (diff)

Show differences between translation files:

```bash
# Compare source with all targets
i18next-toolkit diff

# Compare specific languages
i18next-toolkit diff --source=en --target=de,fr

# Show detailed key list
i18next-toolkit diff --detailed
```

### Translation statistics

View translation coverage and statistics:

```bash
# Show stats for all languages
i18next-toolkit stats

# Show namespace breakdown
i18next-toolkit stats --show-namespaces

# Show top untranslated keys
i18next-toolkit stats --show-untranslated=20
```

### Clean unused keys

Remove translation keys not used in code:

```bash
# Preview what would be removed
i18next-toolkit clean --dry-run

# Actually remove unused keys
i18next-toolkit clean

# Clean specific languages
i18next-toolkit clean --languages=en,de
```

### Sort keys

Alphabetically sort translation files:

```bash
# Sort all language files
i18next-toolkit sort

# Check if files need sorting (for CI)
i18next-toolkit sort --check
```

### Validate translations

Check translation files for issues:

```bash
# Validate all languages
i18next-toolkit validate

# Treat warnings as errors (for CI)
i18next-toolkit validate --strict

# Validate specific languages
i18next-toolkit validate --languages=en,de
```

Issues detected:
- Invalid JSON syntax
- Empty translation values
- Missing keys (compared to source)
- Extra keys (not in source)
- Interpolation mismatches (`{{var}}` placeholders)
- Trailing whitespace

### Shell completion

Enable tab completion in your shell:

```bash
# Bash - add to ~/.bashrc
eval "$(i18next-toolkit completion --shell bash)"

# Zsh - add to ~/.zshrc
eval "$(i18next-toolkit completion --shell zsh)"

# Fish - run once
i18next-toolkit completion --shell fish > ~/.config/fish/completions/i18next-toolkit.fish
```

## Programmatic API

```typescript
import {
  extract,
  findMissing,
  sync,
  translate,
  update,
  watch,
  loadConfig,
  TranslationCache,
} from 'i18next-toolkit';

// Load configuration
const config = loadConfig();

// Extract strings
const extractResult = await extract({
  mode: 'extract',
  include: 'src/**/*.{ts,tsx}',
  localesPath: 'public/locales',
  sourcePattern: '[а-яёА-ЯЁ]', // Russian (default)
  autoGetters: true,
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

// Auto-translate with caching
const translateResult = await translate({
  localesPath: 'public/locales',
  from: 'ru',
  to: ['en', 'kk'],
  batchSize: 50,
  concurrency: 5,
  useCache: true, // Enable caching (default)
});

for (const lang of translateResult.languages) {
  console.log(`${lang.code}: translated ${lang.translated} strings`);
}

// Update: sync + translate
const updateResult = await update({
  localesPath: 'public/locales',
  sourceLanguage: 'ru',
  targetLanguages: ['en', 'kk'],
});

// Watch for changes
const stopWatching = await watch({
  include: 'src/**/*.{ts,tsx}',
  localesPath: 'public/locales',
});

// Later: stop watching
stopWatching();
```

## Advanced Features

### Translation Caching

Translations are cached to avoid redundant API calls:

```typescript
import { TranslationCache, createCache } from 'i18next-toolkit';

// Create and load cache
const cache = await createCache();

// Check cache
const cached = cache.get('Hello', 'en', 'ru');
if (cached) {
  console.log('From cache:', cached);
}

// Cache is automatically used by translate command
await translate({
  useCache: true, // default
  cachePath: '.i18next-toolkit-cache.json', // default
});
```

Cache file: `.i18next-toolkit-cache.json` (auto-created, add to `.gitignore`)

### Retry Logic & Rate Limiting

The translator includes built-in resilience:

- **Retry**: Up to 3 retries with exponential backoff (1-10s)
- **Rate Limiting**: Token bucket algorithm (5 req/s, 3 concurrent)
- **Timeout**: 10 second timeout per request
- **Fallback**: Returns original text on persistent failure

### Custom Source Patterns

Extract strings in any language:

```bash
# Russian (default)
i18next-toolkit extract --source-pattern="[а-яёА-ЯЁ]"

# Chinese
i18next-toolkit extract --source-pattern="[\u4e00-\u9fff]"

# Arabic
i18next-toolkit extract --source-pattern="[\u0600-\u06FF]"

# Japanese (Hiragana + Katakana + Kanji)
i18next-toolkit extract --source-pattern="[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]"
```

### Auto-Getters Mode

Solves the "t() called before i18n initialized" problem for module-level constants:

```typescript
// Before
const LABELS = {
  title: 'Заголовок',  // Error: t() not ready
};

// After (with --auto-getters)
const LABELS = {
  get title() { return t('extracted.zagolovok'); },
};
```

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
.i18next-toolkitrc.json    # Config file
.i18next-toolkit-cache.json # Translation cache (gitignore)
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
| `--source-pattern` | `[а-яёА-ЯЁ]` | Regex to match source strings |
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

### watch

| Option | Default | Description |
|--------|---------|-------------|
| `--include` | `src/**/*.{ts,tsx,js,jsx}` | Glob pattern |
| `--locales-path` | `public/locales` | Locales directory |
| `--category` | `extracted` | Key prefix category |
| `--source-pattern` | `[а-яёА-ЯЁ]` | Regex to match source strings |
| `--debounce` | `300` | Debounce delay in ms |

### diff

| Option | Default | Description |
|--------|---------|-------------|
| `--locales-path` | `public/locales` | Locales directory |
| `--source` | `ru` | Source language |
| `--target` | - | Target languages (comma-separated) |
| `--detailed` | `false` | Show detailed key list |

### stats

| Option | Default | Description |
|--------|---------|-------------|
| `--locales-path` | `public/locales` | Locales directory |
| `--languages` | - | Languages to analyze |
| `--show-namespaces` | `false` | Show breakdown by namespace |
| `--show-untranslated` | `10` | Number of untranslated keys to show |

### clean

| Option | Default | Description |
|--------|---------|-------------|
| `--locales-path` | `public/locales` | Locales directory |
| `--include` | `src/**/*.{ts,tsx,js,jsx}` | Glob pattern for source files |
| `--languages` | - | Languages to clean |
| `--dry-run` | `false` | Preview without removing |

### sort

| Option | Default | Description |
|--------|---------|-------------|
| `--locales-path` | `public/locales` | Locales directory |
| `--languages` | - | Languages to sort |
| `--check` | `false` | Check only, exit with error if unsorted |

### validate

| Option | Default | Description |
|--------|---------|-------------|
| `--locales-path` | `public/locales` | Locales directory |
| `--languages` | - | Languages to validate |
| `--source` | `ru` | Source language for comparison |
| `--strict` | `false` | Treat warnings as errors |

## CI/CD Integration

```yaml
# .github/workflows/i18n.yml
name: i18n Sync

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'public/locales/**'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx i18next-toolkit update
      - run: npx i18next-toolkit find-missing

  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx i18next-toolkit validate --strict
      - run: npx i18next-toolkit sort --check
```

## License

MIT
