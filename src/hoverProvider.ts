import * as vscode from 'vscode';
import type { LocaleIndex } from './localeIndex';
import { findKeyAtPosition } from './usageRegex';

const FLAGS: Record<string, string> = {
  fr: '🇫🇷',
  en: '🇬🇧',
};

function flag(locale: string): string {
  return FLAGS[locale] ?? '🌐';
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*`[\]]/g, (char) => `\\${char}`);
}

export function createHoverProvider(getIndex: () => LocaleIndex): vscode.HoverProvider {
  return {
    provideHover(document, position) {
      const line = document.lineAt(position.line).text;
      const keyPath = findKeyAtPosition(line, position.character);
      if (!keyPath) {
        return undefined;
      }

      const index = getIndex();
      const md = new vscode.MarkdownString('', true);
      md.isTrusted = true;
      md.appendMarkdown(`**${escapeMarkdown(keyPath)}**\n\n`);

      let foundAny = false;
      for (const locale of index.locales) {
        const entry = index.byLocale.get(locale)?.get(keyPath);
        const value = entry?.value ?? '';
        foundAny = foundAny || value.trim().length > 0;
        const display = value.trim().length ? escapeMarkdown(value) : '_(manquant)_';
        const args = encodeURIComponent(JSON.stringify([keyPath, locale]));
        md.appendMarkdown(
          `${flag(locale)} **${locale}** — ${display} &nbsp; [✏️ éditer](command:betterI18n.editValue?${args})\n\n`,
        );
      }

      if (!foundAny) {
        return undefined;
      }

      const duplicate = index.duplicates.find((dup) => dup.keyPath === keyPath);
      if (duplicate) {
        md.appendMarkdown(
          `⚠️ clé définie dans plusieurs fichiers : ${duplicate.files.join(', ')} — édition désactivée jusqu'à résolution.\n\n`,
        );
      }

      return new vscode.Hover(md);
    },
  };
}
