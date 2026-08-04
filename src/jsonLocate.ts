export interface TextPosition {
  line: number;
  character: number;
}

/**
 * Finds the character offset of the key literal at `segments` in a JSON text,
 * by walking the real structure (brace-depth + key matching) rather than a
 * plain substring search — needed because the same last segment (e.g. "label")
 * can appear under multiple parents in the same file.
 */
export function locateKeyInText(text: string, segments: (string | number)[]): TextPosition | undefined {
  const n = text.length;
  let i = 0;
  let found: number | undefined;

  function isWs(ch: string): boolean {
    return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
  }

  function skipWs(): void {
    while (i < n && isWs(text[i])) i++;
  }

  function readString(): string {
    // assumes text[i] === '"'
    i++;
    let out = '';
    while (i < n) {
      const ch = text[i];
      if (ch === '\\') {
        out += ch + text[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') {
        i++;
        return out;
      }
      out += ch;
      i++;
    }
    throw new Error('Better i18n: unterminated string while locating key');
  }

  function skipArray(): void {
    i++; // [
    skipWs();
    if (text[i] === ']') {
      i++;
      return;
    }
    while (true) {
      skipValue();
      skipWs();
      if (text[i] === ',') {
        i++;
        skipWs();
        continue;
      }
      if (text[i] === ']') {
        i++;
        return;
      }
      throw new Error('Better i18n: malformed array while locating key');
    }
  }

  function skipValue(): void {
    skipWs();
    const ch = text[i];
    if (ch === '"') {
      readString();
      return;
    }
    if (ch === '{') {
      walkObject(undefined);
      return;
    }
    if (ch === '[') {
      skipArray();
      return;
    }
    while (i < n && ',}]'.indexOf(text[i]) === -1 && !isWs(text[i])) i++;
  }

  function walkObject(parentPath: (string | number)[] | undefined): void {
    i++; // {
    skipWs();
    if (text[i] === '}') {
      i++;
      return;
    }
    while (true) {
      skipWs();
      const keyStart = i;
      const key = readString();
      skipWs();
      i++; // :
      skipWs();

      const currentPath = parentPath ? [...parentPath, key] : [key];
      const matches = segments.length === currentPath.length && segments.every((s, idx) => s === currentPath[idx]);
      if (matches && found === undefined) {
        found = keyStart;
      }

      if (text[i] === '{') {
        walkObject(currentPath);
      } else {
        skipValue();
      }

      skipWs();
      if (text[i] === ',') {
        i++;
        continue;
      }
      if (text[i] === '}') {
        i++;
        return;
      }
      throw new Error('Better i18n: malformed object while locating key');
    }
  }

  skipWs();
  if (text[i] === '{') {
    walkObject(undefined);
  }

  if (found === undefined) {
    return undefined;
  }
  const before = text.slice(0, found);
  const lines = before.split('\n');
  return { line: lines.length - 1, character: lines[lines.length - 1].length };
}
