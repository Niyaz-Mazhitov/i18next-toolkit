import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from '@babel/types';
import type { ExtractOptions, ExtractResult, FoundString, TranslationJson } from '../types/index.js';
import {
  parseCode,
  DEFAULT_IGNORE_PATTERNS,
  DEFAULT_INCLUDE_PATTERN,
  SKIP_CALLEE_NAMES,
  SKIP_JSX_ATTRIBUTES,
} from '../core/parser.js';
import { generateKey, hasRussian } from '../core/transliterate.js';

const traverse = (_traverse as unknown as { default: typeof _traverse }).default || _traverse;
const generate = (_generate as unknown as { default: typeof _generate }).default || _generate;

const DEFAULT_LOCALES_PATH = 'public/locales';
const DEFAULT_CATEGORY = 'extracted';

// Shared state for key generation
let usedKeys: Set<string>;
let translations: Record<string, string>;

/**
 * Check if node is inside t() call
 */
function isInsideTCall(nodePath: NodePath): boolean {
  let parent = nodePath.parentPath;
  while (parent) {
    if (
      parent.isCallExpression() &&
      parent.node.callee &&
      'name' in parent.node.callee &&
      parent.node.callee.name === 't'
    ) {
      return true;
    }
    parent = parent.parentPath;
  }
  return false;
}

/**
 * Get callee name (e.g., 'console.log', 'Error')
 */
function getCalleeName(callExpr: t.CallExpression | t.NewExpression): string | null {
  const callee = callExpr.callee;
  if (!callee) return null;

  if (callee.type === 'Identifier') {
    return callee.name;
  }

  if (callee.type === 'MemberExpression') {
    const obj = callee.object;
    const prop = callee.property;
    if (obj?.type === 'Identifier' && prop?.type === 'Identifier') {
      return `${obj.name}.${prop.name}`;
    }
  }

  return null;
}

/**
 * Check if inside console.log/Error/throw
 */
function isInsideSkippedCall(nodePath: NodePath): boolean {
  let parent = nodePath.parentPath;
  while (parent) {
    if (parent.isCallExpression() || parent.isNewExpression()) {
      const calleeName = getCalleeName(parent.node as t.CallExpression);
      if (calleeName && SKIP_CALLEE_NAMES.has(calleeName)) {
        return true;
      }
    }
    if (parent.isThrowStatement()) {
      return true;
    }
    parent = parent.parentPath;
  }
  return false;
}

/**
 * Check if inside skipped JSX attribute
 */
function isSkippedJSXAttribute(nodePath: NodePath): boolean {
  if (!nodePath.parentPath?.isJSXAttribute()) return false;
  const attrName = (nodePath.parentPath.node as t.JSXAttribute).name?.name;
  return typeof attrName === 'string' && SKIP_JSX_ATTRIBUTES.has(attrName);
}

/**
 * Check if inside function scope (for --auto-getters)
 */
function isInsideFunctionScope(nodePath: NodePath): boolean {
  let current = nodePath.parentPath;
  while (current) {
    if (
      t.isFunctionDeclaration(current.node) ||
      t.isFunctionExpression(current.node) ||
      t.isArrowFunctionExpression(current.node) ||
      t.isObjectMethod(current.node) ||
      t.isClassMethod(current.node)
    ) {
      return true;
    }
    current = current.parentPath;
  }
  return false;
}

/**
 * Get parent ObjectProperty if exists (for --auto-getters)
 */
function getParentObjectProperty(nodePath: NodePath): NodePath<t.ObjectProperty> | null {
  let current = nodePath.parentPath;
  while (current) {
    if (t.isObjectProperty(current.node)) {
      return current as NodePath<t.ObjectProperty>;
    }
    if (
      t.isCallExpression(current.node) ||
      t.isJSXElement(current.node) ||
      t.isStatement(current.node) ||
      t.isArrayExpression(current.node)
    ) {
      return null;
    }
    current = current.parentPath;
  }
  return null;
}

/**
 * Try to replace ObjectProperty with getter (for --auto-getters)
 */
function tryReplaceWithGetter(
  nodePath: NodePath,
  tCall: t.CallExpression,
  autoGetters: boolean
): boolean {
  if (!autoGetters) return false;

  const objectPropertyPath = getParentObjectProperty(nodePath);
  if (!objectPropertyPath) return false;

  if (isInsideFunctionScope(objectPropertyPath)) return false;

  const key = objectPropertyPath.node.key;
  if (objectPropertyPath.node.computed) return false;

  let keyNode: t.Identifier;
  if (t.isIdentifier(key)) {
    keyNode = t.identifier(key.name);
  } else if (t.isStringLiteral(key)) {
    keyNode = t.identifier(key.value);
  } else {
    return false;
  }

  const getter = t.objectMethod(
    'get',
    keyNode,
    [],
    t.blockStatement([t.returnStatement(tCall)])
  );

  objectPropertyPath.replaceWith(getter);
  return true;
}

/**
 * Process a single file
 */
function processFile(
  filePath: string,
  root: string,
  options: ExtractOptions
): { found: FoundString[]; modified: boolean } {
  const code = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(root, filePath);
  const found: FoundString[] = [];
  const category = options.category || DEFAULT_CATEGORY;

  let ast;
  try {
    ast = parseCode(code, relPath);
  } catch (e) {
    console.warn(`⚠ Parse error ${relPath}: ${(e as Error).message}`);
    return { found: [], modified: false };
  }

  let modified = false;

  traverse(ast, {
    // String literals
    StringLiteral(p: NodePath<t.StringLiteral>) {
      const value = p.node.value;
      if (!hasRussian(value)) return;
      if (isInsideTCall(p)) return;
      if (isInsideSkippedCall(p)) return;
      if (isSkippedJSXAttribute(p)) return;

      // Skip imports
      if (p.parentPath.isImportDeclaration()) return;

      // Skip object keys (not values)
      if (p.parentPath.isObjectProperty() && p.parentPath.node.key === p.node) return;

      // Skip TypeScript types
      if (p.parentPath.isTSLiteralType?.()) return;
      if (p.parentPath.isTSEnumMember?.()) return;

      // Skip exports
      if (p.parentPath.isExportNamedDeclaration()) return;

      // Skip switch/case
      if (p.parentPath.isSwitchCase()) return;

      const line = p.node.loc?.start?.line || 0;
      const key = generateKey(value, category, usedKeys, translations);

      found.push({
        file: relPath,
        line,
        text: value,
        key,
        type: 'StringLiteral',
      });

      if (options.mode === 'extract') {
        translations[key] = value;
        const tCall = t.callExpression(t.identifier('t'), [t.stringLiteral(key)]);

        if (tryReplaceWithGetter(p, tCall, options.autoGetters || false)) {
          modified = true;
          return;
        }

        if (p.parentPath.isJSXAttribute()) {
          p.replaceWith(t.jsxExpressionContainer(tCall));
        } else {
          p.replaceWith(tCall);
        }
        modified = true;
      }
    },

    // Template literals
    TemplateLiteral(p: NodePath<t.TemplateLiteral>) {
      if (isInsideTCall(p)) return;
      if (isInsideSkippedCall(p)) return;

      const quasis = p.node.quasis;
      const expressions = p.node.expressions;

      const fullText = quasis.map((q) => q.value.raw).join('{{}}');
      if (!hasRussian(fullText)) return;

      const line = p.node.loc?.start?.line || 0;

      // Simple template without expressions
      if (expressions.length === 0) {
        const value = quasis[0]?.value?.raw || '';
        const key = generateKey(value, category, usedKeys, translations);

        found.push({
          file: relPath,
          line,
          text: value,
          key,
          type: 'TemplateLiteral',
        });

        if (options.mode === 'extract') {
          translations[key] = value;
          const tCall = t.callExpression(t.identifier('t'), [t.stringLiteral(key)]);

          if (tryReplaceWithGetter(p, tCall, options.autoGetters || false)) {
            modified = true;
            return;
          }

          p.replaceWith(tCall);
          modified = true;
        }
        return;
      }

      // Template with interpolations
      const interpolations: Record<string, t.Expression> = {};
      let translationText = '';

      for (let i = 0; i < quasis.length; i++) {
        translationText += quasis[i].value.raw;
        if (i < expressions.length) {
          const expr = expressions[i];
          const paramName = expr.type === 'Identifier' ? expr.name : `arg${i}`;
          interpolations[paramName] = expr as t.Expression;
          translationText += `{{${paramName}}}`;
        }
      }

      const key = generateKey(translationText, category, usedKeys, translations);

      found.push({
        file: relPath,
        line,
        text: translationText,
        key,
        type: 'TemplateLiteralWithExpressions',
        interpolations: Object.keys(interpolations),
      });

      if (options.mode === 'extract') {
        translations[key] = translationText;

        const objectProps = Object.entries(interpolations).map(([name, expr]) =>
          t.objectProperty(
            t.identifier(name),
            expr,
            false,
            expr.type === 'Identifier' && expr.name === name
          )
        );

        const tCall = t.callExpression(t.identifier('t'), [
          t.stringLiteral(key),
          t.objectExpression(objectProps),
        ]);

        if (tryReplaceWithGetter(p, tCall, options.autoGetters || false)) {
          modified = true;
          return;
        }

        p.replaceWith(tCall);
        modified = true;
      }
    },

    // JSX text
    JSXText(p: NodePath<t.JSXText>) {
      const value = p.node.value.trim();
      if (!hasRussian(value)) return;

      const line = p.node.loc?.start?.line || 0;
      const key = generateKey(value, category, usedKeys, translations);

      found.push({
        file: relPath,
        line,
        text: value,
        key,
        type: 'JSXText',
      });

      if (options.mode === 'extract') {
        translations[key] = value;
        p.replaceWith(
          t.jsxExpressionContainer(t.callExpression(t.identifier('t'), [t.stringLiteral(key)]))
        );
        modified = true;
      }
    },
  });

  if (modified && options.mode === 'extract' && !options.dryRun) {
    const output = generate(ast, { retainLines: true }, code);
    fs.writeFileSync(filePath, output.code, 'utf8');
  }

  return { found, modified };
}

/**
 * Validate t() keys exist in translations
 */
function validateFile(
  filePath: string,
  root: string,
  allTranslations: TranslationJson
): { key: string; file: string; line: number }[] {
  const code = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(root, filePath);
  const missing: { key: string; file: string; line: number }[] = [];

  let ast;
  try {
    ast = parseCode(code, relPath);
  } catch {
    return [];
  }

  const getNestedValue = (obj: TranslationJson, keyPath: string): string | undefined => {
    const parts = keyPath.split('.');
    let current: TranslationJson | string | undefined = obj;

    for (const part of parts) {
      if (current === undefined || typeof current === 'string') return undefined;
      current = current[part];
    }

    return typeof current === 'string' ? current : undefined;
  };

  traverse(ast, {
    CallExpression(p: NodePath<t.CallExpression>) {
      const callee = p.node.callee;
      if (callee.type !== 'Identifier' || callee.name !== 't') return;

      const firstArg = p.node.arguments[0];
      if (!firstArg || firstArg.type !== 'StringLiteral') return;

      const key = firstArg.value;
      if (getNestedValue(allTranslations, key) === undefined) {
        missing.push({
          key,
          file: relPath,
          line: p.node.loc?.start?.line || 0,
        });
      }
    },
  });

  return missing;
}

export interface ExtractCommandOptions extends ExtractOptions {
  /** Silent mode - no console output */
  silent?: boolean;
}

/**
 * Extract Russian strings from code and replace with t() calls
 */
export async function extract(options: ExtractCommandOptions = {}): Promise<ExtractResult> {
  const root = options.root || process.cwd();
  const mode = options.mode || 'report';
  const include = options.include || DEFAULT_INCLUDE_PATTERN;
  const localesPath = options.localesPath || DEFAULT_LOCALES_PATH;
  const category = options.category || DEFAULT_CATEGORY;

  // Initialize shared state
  usedKeys = new Set<string>();
  translations = {};

  const localeFile = path.join(root, localesPath, 'ru', 'translation.json');

  if (!options.silent) {
    console.log(`=== Extract Russian strings ===`);
    console.log(`Mode: ${mode}${options.dryRun ? ' (dry-run)' : ''}${options.autoGetters ? ' (auto-getters)' : ''}`);
  }

  // Load existing translations
  let existingTranslations: TranslationJson = {};
  try {
    const existing = JSON.parse(fs.readFileSync(localeFile, 'utf8'));
    existingTranslations = (existing[category] as TranslationJson) || {};

    // Add existing keys to usedKeys
    for (const key of Object.keys(existingTranslations)) {
      usedKeys.add(`${category}.${key}`);
      translations[`${category}.${key}`] = existingTranslations[key] as string;
    }
  } catch {
    // File doesn't exist or invalid JSON
  }

  // Get files
  let files: string[];
  if (options.file) {
    const absolutePath = path.isAbsolute(options.file) ? options.file : path.join(root, options.file);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${options.file}`);
    }
    files = [absolutePath];
    if (!options.silent) {
      console.log(`File: ${options.file}\n`);
    }
  } else {
    if (!options.silent) {
      console.log(`Pattern: ${include}\n`);
    }
    files = await fg(include, {
      cwd: root,
      absolute: true,
      ignore: DEFAULT_IGNORE_PATTERNS,
    });
  }

  if (!options.silent) {
    console.log(`Files found: ${files.length}\n`);
  }

  // Validate mode
  if (mode === 'validate') {
    let allTranslations: TranslationJson = {};
    try {
      allTranslations = JSON.parse(fs.readFileSync(localeFile, 'utf8'));
    } catch {
      if (!options.silent) {
        console.error(`❌ Failed to load ${localeFile}`);
      }
      return { found: [], modifiedFiles: [], translations: {} };
    }

    const allMissing: { key: string; file: string; line: number }[] = [];
    for (const file of files) {
      allMissing.push(...validateFile(file, root, allTranslations));
    }

    if (!options.silent) {
      if (allMissing.length === 0) {
        console.log('✅ All keys found in translations!');
      } else {
        console.log(`❌ Found ${allMissing.length} missing keys:\n`);

        const byFile = new Map<string, typeof allMissing>();
        for (const item of allMissing) {
          if (!byFile.has(item.file)) byFile.set(item.file, []);
          byFile.get(item.file)!.push(item);
        }

        for (const [file, items] of byFile) {
          console.log(`📄 ${file}`);
          for (const item of items) {
            console.log(`   L${item.line}: t('${item.key}')`);
          }
        }
      }
    }

    return { found: [], modifiedFiles: [], translations: {} };
  }

  // Report or extract mode
  const allFound: FoundString[] = [];
  const modifiedFiles: string[] = [];

  for (const file of files) {
    const { found, modified } = processFile(file, root, { ...options, category });
    allFound.push(...found);
    if (modified) {
      modifiedFiles.push(path.relative(root, file));
    }
  }

  // Output results
  if (!options.silent && mode === 'report') {
    console.log(`\n=== Found Russian strings: ${allFound.length} ===\n`);

    const byFile = new Map<string, FoundString[]>();
    for (const item of allFound) {
      if (!byFile.has(item.file)) byFile.set(item.file, []);
      byFile.get(item.file)!.push(item);
    }

    for (const [file, items] of byFile) {
      console.log(`\n📄 ${file}`);
      for (const item of items) {
        const shortText = item.text.length > 60 ? item.text.substring(0, 60) + '...' : item.text;
        console.log(`   L${item.line}: "${shortText}"`);
        console.log(`         → ${item.key}`);
      }
    }

    // Statistics
    if (allFound.length > 0) {
      console.log('\n📊 Statistics:');
      console.log('─'.repeat(40));

      const byType: Record<string, number> = {};
      for (const item of allFound) {
        byType[item.type] = (byType[item.type] || 0) + 1;
      }

      console.log('\nBy type:');
      const typeLabels: Record<string, string> = {
        StringLiteral: 'Strings',
        TemplateLiteral: 'Templates',
        TemplateLiteralWithExpressions: 'Templates with vars',
        JSXText: 'JSX text',
      };
      for (const [type, count] of Object.entries(byType)) {
        console.log(`  ${typeLabels[type] || type}: ${count}`);
      }

      console.log('\nTop files:');
      const sortedFiles = Array.from(byFile.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 10);
      for (const [file, items] of sortedFiles) {
        console.log(`  ${items.length.toString().padStart(4)} │ ${file}`);
      }
    }
  }

  if (mode === 'extract') {
    // Save translations to JSON
    try {
      const existing = JSON.parse(fs.readFileSync(localeFile, 'utf8'));

      if (!existing[category]) existing[category] = {};

      let newCount = 0;
      for (const [key, value] of Object.entries(translations)) {
        const parts = key.split('.');
        if (parts[0] === category) {
          const shortKey = parts.slice(1).join('.');
          if (!existingTranslations[shortKey]) {
            newCount++;
          }
          existing[category][shortKey] = value;
        }
      }

      if (!options.dryRun) {
        fs.writeFileSync(localeFile, JSON.stringify(existing, null, 2) + '\n', 'utf8');
        if (!options.silent) {
          console.log(`\n✓ Added ${newCount} new translations to ${localeFile}`);
        }
      } else {
        if (!options.silent) {
          console.log(`\n[DRY-RUN] Would add ${newCount} new translations`);
        }
      }
    } catch {
      // Ignore errors
    }

    if (!options.silent && modifiedFiles.length > 0) {
      console.log(
        `\n${options.dryRun ? '[DRY-RUN] Would modify' : 'Modified'} files: ${modifiedFiles.length}`
      );
      for (const f of modifiedFiles.slice(0, 20)) {
        console.log(`  - ${f}`);
      }
      if (modifiedFiles.length > 20) {
        console.log(`  ... and ${modifiedFiles.length - 20} more`);
      }
    }
  }

  if (!options.silent) {
    console.log('\n✓ Done!');
  }

  return {
    found: allFound,
    modifiedFiles,
    translations,
  };
}
