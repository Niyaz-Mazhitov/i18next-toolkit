import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type { CallExpression } from '@babel/types';
import type { FindMissingOptions, FindMissingResult, MissingKey, TranslationJson } from '../types/index.js';
import { parseCode, DEFAULT_IGNORE_PATTERNS, DEFAULT_INCLUDE_PATTERN } from '../core/parser.js';
import { countKeys, getNestedValue } from '../core/json-utils.js';
import { colors, output } from '../core/output.js';

const traverse = (_traverse as unknown as { default: typeof _traverse }).default || _traverse;

const DEFAULT_LOCALES_PATH = 'public/locales';
const DEFAULT_SOURCE_LANGUAGE = 'ru';

interface UsedKey {
  key: string;
  file: string;
  line: number;
}

/**
 * Collect all keys from translation object recursively
 */
function collectAllKeys(obj: TranslationJson, prefix = ''): Set<string> {
  const keys = new Set<string>();

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const nestedKey of collectAllKeys(value, fullKey)) {
        keys.add(nestedKey);
      }
    } else {
      keys.add(fullKey);
    }
  }

  return keys;
}

/**
 * Find all t('key') usages in a file
 */
function findUsedKeysInFile(
  filePath: string,
  root: string,
  translations: TranslationJson
): { usedKeys: UsedKey[]; missing: UsedKey[] } {
  const code = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(root, filePath);
  const usedKeys: UsedKey[] = [];

  let ast;
  try {
    ast = parseCode(code, relPath);
  } catch (error) {
    // Parse errors are expected for non-JS files or syntax errors
    // Silently skip these files
    return { usedKeys: [], missing: [] };
  }

  traverse(ast, {
    CallExpression(p: NodePath<CallExpression>) {
      const callee = p.node.callee;

      // t('key') or i18n.t('key')
      const isTCall =
        (callee.type === 'Identifier' && callee.name === 't') ||
        (callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 't' &&
          callee.object.type === 'Identifier' &&
          (callee.object.name === 'i18n' || callee.object.name === 'i18next'));

      if (!isTCall) return;

      const firstArg = p.node.arguments[0];
      if (!firstArg) return;

      // String literal: t('key')
      if (firstArg.type === 'StringLiteral') {
        usedKeys.push({
          key: firstArg.value,
          file: relPath,
          line: p.node.loc?.start?.line || 0,
        });
      }
      // Template literal without expressions: t(`key`)
      else if (firstArg.type === 'TemplateLiteral' && firstArg.expressions.length === 0) {
        usedKeys.push({
          key: firstArg.quasis[0]?.value?.raw || '',
          file: relPath,
          line: p.node.loc?.start?.line || 0,
        });
      }
    },
  });

  // Check which keys are missing
  const missing = usedKeys.filter((item) => {
    const exists = getNestedValue(translations, item.key) !== undefined;
    return !exists;
  });

  return { usedKeys, missing };
}

export interface FindMissingCommandOptions extends FindMissingOptions {
  /** Silent mode - no console output */
  silent?: boolean;
}

/**
 * Find translation keys used in code that are missing from translation file
 */
export async function findMissing(options: FindMissingCommandOptions = {}): Promise<FindMissingResult> {
  const root = options.root || process.cwd();
  const localesPath = options.localesPath || DEFAULT_LOCALES_PATH;
  const include = options.include || DEFAULT_INCLUDE_PATTERN;
  const sourceLanguage = options.sourceLanguage || DEFAULT_SOURCE_LANGUAGE;

  const translationFile = path.join(root, localesPath, sourceLanguage, 'translation.json');

  if (!options.silent) {
    output.header('Find Missing Keys');
    output.keyValue('Source', sourceLanguage);
  }

  // Load translations
  let translations: TranslationJson = {};
  try {
    translations = JSON.parse(fs.readFileSync(translationFile, 'utf8'));
  } catch (e) {
    if (!options.silent) {
      output.error(`Failed to load ${translationFile}`);
    }
    return {
      totalKeysInTranslation: 0,
      totalKeysUsedInCode: 0,
      missingKeysCount: 0,
      missingKeys: [],
    };
  }

  const allTranslationKeys = collectAllKeys(translations);

  if (!options.silent) {
    output.keyValue('Keys in file', allTranslationKeys.size);
  }

  // Get files to process
  const files = await fg(include, {
    cwd: root,
    absolute: true,
    ignore: DEFAULT_IGNORE_PATTERNS,
  });

  if (!options.silent) {
    output.keyValue('Scanning files', files.length);
    output.newline();
  }

  const allMissing: UsedKey[] = [];
  const allUsedKeys = new Set<string>();

  for (const file of files) {
    const { usedKeys, missing } = findUsedKeysInFile(file, root, translations);

    for (const item of usedKeys) {
      allUsedKeys.add(item.key);
    }

    allMissing.push(...missing);
  }

  // Deduplicate by key
  const uniqueMissing = new Map<string, { file: string; line: number }[]>();

  for (const item of allMissing) {
    if (!uniqueMissing.has(item.key)) {
      uniqueMissing.set(item.key, []);
    }
    uniqueMissing.get(item.key)!.push({ file: item.file, line: item.line });
  }

  // Output results
  if (!options.silent) {
    if (uniqueMissing.size === 0) {
      output.success('All used keys found in translation.json!');
    } else {
      output.error(`Found ${uniqueMissing.size} missing keys:`);
      output.newline();

      // Group by namespace
      const byNamespace = new Map<string, { key: string; locations: { file: string; line: number }[] }[]>();

      for (const [key, locations] of uniqueMissing) {
        const namespace = key.split('.')[0] || 'root';
        if (!byNamespace.has(namespace)) {
          byNamespace.set(namespace, []);
        }
        byNamespace.get(namespace)!.push({ key, locations });
      }

      for (const [namespace, items] of byNamespace) {
        console.log(`${colors.symbols.folder} ${colors.bold(namespace)} ${colors.dim(`(${items.length})`)}`);

        for (const { key, locations } of items.sort((a, b) => a.key.localeCompare(b.key))) {
          const firstLoc = locations[0];
          const moreCount = locations.length > 1 ? colors.dim(` (+${locations.length - 1} more)`) : '';
          console.log(`   ${colors.symbols.error} ${colors.key(key)}  ${colors.symbols.arrow}  ${colors.path(`${firstLoc.file}:${firstLoc.line}`)}${moreCount}`);
        }

        console.log();
      }
    }

    output.separator();
    output.newline();
    output.dim('Statistics:');
    output.keyValue('Keys in translation.json', allTranslationKeys.size, 2);
    output.keyValue('Keys used in code', allUsedKeys.size, 2);
    output.keyValue('Missing keys', uniqueMissing.size, 2);
  }

  // Convert to result format
  const missingKeys: MissingKey[] = Array.from(uniqueMissing.entries()).map(([key, locations]) => ({
    key,
    locations,
  }));

  return {
    totalKeysInTranslation: allTranslationKeys.size,
    totalKeysUsedInCode: allUsedKeys.size,
    missingKeysCount: uniqueMissing.size,
    missingKeys,
  };
}
