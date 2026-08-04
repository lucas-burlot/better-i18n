export const USAGE_RE = /\$?\bt\(\s*(['"`])([^'"`]+)\1/g;

export interface KeyMatch {
  keyPath: string;
  quoteChar: string;
  matchStart: number;
  matchEnd: number;
  keyStart: number;
  keyEnd: number;
}

export function findKeyMatchesInLine(line: string): KeyMatch[] {
  const matches: KeyMatch[] = [];
  for (const match of line.matchAll(USAGE_RE)) {
    const whole = match[0];
    const quoteChar = match[1];
    const keyPath = match[2];
    const matchStart = match.index ?? 0;
    const keyStart = matchStart + whole.indexOf(quoteChar) + 1;
    matches.push({
      keyPath,
      quoteChar,
      matchStart,
      matchEnd: matchStart + whole.length,
      keyStart,
      keyEnd: keyStart + keyPath.length,
    });
  }
  return matches;
}

export function findKeyMatchAtPosition(line: string, character: number): KeyMatch | undefined {
  for (const match of findKeyMatchesInLine(line)) {
    if (character >= match.matchStart && character <= match.matchEnd) {
      return match;
    }
  }
  return undefined;
}

export function findKeyAtPosition(line: string, character: number): string | undefined {
  return findKeyMatchAtPosition(line, character)?.keyPath;
}
