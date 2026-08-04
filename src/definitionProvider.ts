import * as fs from 'fs';
import * as vscode from 'vscode';
import type { LocaleIndex } from './localeIndex';
import { locateKeyInText } from './jsonLocate';
import { findKeyMatchAtPosition } from './usageRegex';

export function createDefinitionProvider(getIndex: () => LocaleIndex): vscode.DefinitionProvider {
  return {
    provideDefinition(document, position) {
      const line = document.lineAt(position.line).text;
      const match = findKeyMatchAtPosition(line, position.character);
      if (!match) {
        return undefined;
      }

      const index = getIndex();
      const entry = index.byLocale.get(index.config.sourceLocale)?.get(match.keyPath);
      if (!entry) {
        return undefined;
      }

      const text = fs.readFileSync(entry.file, 'utf8');
      const pos = locateKeyInText(text, entry.segments) ?? { line: 0, character: 0 };

      const link: vscode.LocationLink = {
        originSelectionRange: new vscode.Range(
          position.line,
          match.keyStart - 1,
          position.line,
          match.keyEnd + 1,
        ),
        targetUri: vscode.Uri.file(entry.file),
        targetRange: new vscode.Range(pos.line, pos.character, pos.line, pos.character),
      };
      return [link];
    },
  };
}
