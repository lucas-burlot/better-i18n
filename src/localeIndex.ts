import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface LocaleEntry {
  value: string;
  file: string;
  segments: (string | number)[];
}

export interface DuplicateKey {
  locale: string;
  keyPath: string;
  files: string[];
}

export interface LocaleIndexConfig {
  workspaceRoot: string;
  localesGlob: string;
  sourceLocale: string;
}

export interface LocaleIndex {
  config: LocaleIndexConfig;
  locales: string[];
  byLocale: Map<string, Map<string, LocaleEntry>>;
  duplicates: DuplicateKey[];
}

function localeFromFile(filePath: string): string {
  return path.basename(filePath, '.json');
}

function flatten(
  obj: unknown,
  segments: (string | number)[],
  file: string,
  target: Map<string, LocaleEntry>,
  duplicates: DuplicateKey[],
): void {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return;
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const nextSegments = [...segments, key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, nextSegments, file, target, duplicates);
      continue;
    }
    if (typeof value !== 'string') {
      continue;
    }
    const keyPath = nextSegments.join('.');
    const existing = target.get(keyPath);
    if (existing && existing.file !== file) {
      duplicates.push({ locale: '', keyPath, files: [existing.file, file] });
      continue;
    }
    target.set(keyPath, { value, file, segments: nextSegments });
  }
}

export async function buildLocaleIndex(config: LocaleIndexConfig): Promise<LocaleIndex> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.find(
    (folder) => folder.uri.fsPath === config.workspaceRoot,
  );
  const pattern = workspaceFolder
    ? new vscode.RelativePattern(workspaceFolder, config.localesGlob)
    : path.join(config.workspaceRoot, config.localesGlob);
  const uris = await vscode.workspace.findFiles(pattern);

  const byLocale = new Map<string, Map<string, LocaleEntry>>();
  const duplicates: DuplicateKey[] = [];

  for (const uri of uris) {
    const filePath = uri.fsPath;
    const locale = localeFromFile(filePath);
    let parsed: unknown;
    try {
      const text = fs.readFileSync(filePath, 'utf8');
      parsed = JSON.parse(text);
    } catch (err) {
      vscode.window.showWarningMessage(`Better i18n: impossible de lire ${filePath} (${String(err)})`);
      continue;
    }
    const localeMap = byLocale.get(locale) ?? new Map<string, LocaleEntry>();
    const localDuplicates: DuplicateKey[] = [];
    flatten(parsed, [], filePath, localeMap, localDuplicates);
    for (const dup of localDuplicates) {
      duplicates.push({ ...dup, locale });
    }
    byLocale.set(locale, localeMap);
  }

  return {
    config,
    locales: [...byLocale.keys()].sort(),
    byLocale,
    duplicates,
  };
}

export function sourceKeys(index: LocaleIndex): string[] {
  const sourceMap = index.byLocale.get(index.config.sourceLocale);
  return sourceMap ? [...sourceMap.keys()] : [];
}

export function completion(index: LocaleIndex, locale: string): { total: number; translated: number } {
  const keys = sourceKeys(index);
  const localeMap = index.byLocale.get(locale);
  const translated = keys.filter((key) => {
    const entry = localeMap?.get(key);
    return entry !== undefined && entry.value.trim().length > 0;
  }).length;
  return { total: keys.length, translated };
}

export function missingKeys(index: LocaleIndex, locale: string): string[] {
  const localeMap = index.byLocale.get(locale);
  return sourceKeys(index).filter((key) => {
    const entry = localeMap?.get(key);
    return entry === undefined || entry.value.trim().length === 0;
  });
}
