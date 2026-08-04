import * as vscode from 'vscode';
import type { LocaleIndex } from './localeIndex';
import { findKeyMatchesInLine } from './usageRegex';

const LANGUAGES = ['vue', 'typescript', 'javascript'];

/**
 * Appends the translation at the end of the line as an `after` pseudo-element — anchoring
 * right after the t('key') call would require counting the call's own closing parens vs.
 * whatever wraps it (.min(1, t('key'))), which isn't reliably derivable from a regex match.
 * End-of-line sidesteps that entirely and never touches the real text.
 */
export class InlineTranslationDecorator {
  private readonly decorationType = vscode.window.createTextEditorDecorationType({});

  constructor(private readonly getIndex: () => LocaleIndex) {}

  refresh(editor: vscode.TextEditor | undefined): void {
    if (!editor || !LANGUAGES.includes(editor.document.languageId)) {
      return;
    }
    const index = this.getIndex();
    const decorations: vscode.DecorationOptions[] = [];

    for (let lineNum = 0; lineNum < editor.document.lineCount; lineNum++) {
      const line = editor.document.lineAt(lineNum).text;
      for (const match of findKeyMatchesInLine(line)) {
        const value = index.byLocale.get(index.config.sourceLocale)?.get(match.keyPath)?.value;
        if (!value || !value.trim()) {
          continue;
        }
        const anchor = line.length;
        decorations.push({
          range: new vscode.Range(lineNum, anchor, lineNum, anchor),
          renderOptions: {
            after: {
              contentText: `  ${value}`,
              color: new vscode.ThemeColor('editorGhostText.foreground'),
              fontStyle: 'italic',
            },
          },
        });
      }
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  refreshAll(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.refresh(editor);
    }
  }

  dispose(): void {
    this.decorationType.dispose();
  }
}
