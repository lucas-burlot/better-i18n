import * as fs from 'fs';
import * as path from 'path';
import type { LocaleIndex } from './localeIndex';

function detectEol(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function setAtPath(obj: Record<string, unknown>, segments: (string | number)[], value: string): void {
  let node: Record<string, unknown> = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    node = node[segments[i]] as Record<string, unknown>;
  }
  node[segments[segments.length - 1]] = value;
}

/**
 * Resolves the file+path to write for (locale, keyPath) from the real JSON
 * structure already indexed — never guessed from a filename/layout convention.
 * This is the fix for Loccy's write-to-wrong-file bug: an existing key's own
 * file is authoritative; a key missing only in `locale` reuses the source
 * locale's directory (its sibling file), not some inferred "canonical" file.
 */
function resolveTarget(
  index: LocaleIndex,
  locale: string,
  keyPath: string,
): { file: string; segments: (string | number)[] } {
  const existing = index.byLocale.get(locale)?.get(keyPath);
  if (existing) {
    return { file: existing.file, segments: existing.segments };
  }

  const sourceEntry = index.byLocale.get(index.config.sourceLocale)?.get(keyPath);
  if (!sourceEntry) {
    throw new Error(`Better i18n: clé inconnue "${keyPath}"`);
  }

  const dir = path.dirname(sourceEntry.file);
  const file = path.join(dir, `${locale}.json`);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '{}\n', 'utf8');
  }
  return { file, segments: sourceEntry.segments };
}

export function writeTranslation(index: LocaleIndex, locale: string, keyPath: string, newValue: string): string {
  const { file, segments } = resolveTarget(index, locale, keyPath);
  const text = fs.readFileSync(file, 'utf8');
  const obj = JSON.parse(text) as Record<string, unknown>;
  setAtPath(obj, segments, newValue);

  const eol = detectEol(text);
  let newText = `${JSON.stringify(obj, null, 2)}\n`;
  if (eol === '\r\n') {
    newText = newText.replace(/\n/g, '\r\n');
  }
  fs.writeFileSync(file, newText, 'utf8');
  return file;
}
