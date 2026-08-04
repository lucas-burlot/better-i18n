import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { buildLocaleIndex, type LocaleIndex } from './localeIndex';
import { buildUsageIndex, type UsageIndex } from './usageIndex';
import { writeTranslation } from './writeBack';
import { createHoverProvider } from './hoverProvider';
import { createDefinitionProvider } from './definitionProvider';
import { InlineTranslationDecorator } from './decorations';
import { locateKeyInText } from './jsonLocate';
import { BetterI18nDashboard } from './dashboard';

const LANGUAGES = ['vue', 'typescript', 'javascript'];

function debounce(fn: () => void, delayMs: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(fn, delayMs);
  };
}

export function activate(context: vscode.ExtensionContext): void {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }
  const workspaceRoot = workspaceFolder.uri.fsPath;

  const cfg = vscode.workspace.getConfiguration('betterI18n');
  const localesGlob = cfg.get<string>('localesGlob', 'apps/frontend/i18n/locales/**/*.json');
  const sourceLocale = cfg.get<string>('sourceLocale', 'fr');
  const codeGlobs = cfg.get<string[]>('codeGlobs', [
    'apps/frontend/app/**/*.{vue,ts}',
    'apps/frontend/stories/**/*.{vue,ts}',
  ]);
  const inlineTranslationsEnabled = cfg.get<boolean>('inlineTranslations', true);

  let localeIndex: LocaleIndex;
  let usageIndex: UsageIndex;

  const dashboard = new BetterI18nDashboard(
    () => localeIndex,
    () => usageIndex,
  );
  const decorator = new InlineTranslationDecorator(() => localeIndex);
  if (inlineTranslationsEnabled) {
    context.subscriptions.push({ dispose: () => decorator.dispose() });
  }

  async function rebuild(): Promise<void> {
    localeIndex = await buildLocaleIndex({ workspaceRoot, localesGlob, sourceLocale });
    usageIndex = await buildUsageIndex(workspaceRoot, codeGlobs);
    dashboard.refresh();
    if (inlineTranslationsEnabled) {
      decorator.refreshAll();
    }
  }

  const debouncedRebuild = debounce(() => void rebuild(), 300);
  const debouncedDecorate = debounce(() => decorator.refresh(vscode.window.activeTextEditor), 150);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('betterI18n.dashboard', dashboard),
    vscode.languages.registerHoverProvider(LANGUAGES, createHoverProvider(() => localeIndex)),
    vscode.languages.registerDefinitionProvider(LANGUAGES, createDefinitionProvider(() => localeIndex)),
    vscode.commands.registerCommand('betterI18n.refresh', () => void rebuild()),
    vscode.commands.registerCommand('betterI18n.editValue', async (keyPath: string, locale: string) => {
      if (localeIndex.duplicates.some((dup) => dup.keyPath === keyPath)) {
        vscode.window.showErrorMessage(
          `Better i18n: "${keyPath}" est défini dans plusieurs fichiers — corrige le doublon avant d'éditer.`,
        );
        return;
      }
      const current = localeIndex.byLocale.get(locale)?.get(keyPath)?.value ?? '';
      const input = await vscode.window.showInputBox({
        title: `Better i18n — ${locale}`,
        prompt: keyPath,
        value: current,
        ignoreFocusOut: true,
      });
      if (input === undefined) {
        return;
      }
      try {
        const file = writeTranslation(localeIndex, locale, keyPath, input);
        await rebuild();
        vscode.window.setStatusBarMessage(
          `Better i18n: ${keyPath} (${locale}) → ${path.relative(workspaceRoot, file)}`,
          4000,
        );
      } catch (err) {
        vscode.window.showErrorMessage(String(err));
      }
    }),
    vscode.commands.registerCommand('betterI18n.revealKey', async (keyPath: string) => {
      const entry = localeIndex.byLocale.get(sourceLocale)?.get(keyPath);
      if (!entry) {
        return;
      }
      const doc = await vscode.workspace.openTextDocument(entry.file);
      const editor = await vscode.window.showTextDocument(doc);
      const text = fs.readFileSync(entry.file, 'utf8');
      const pos = locateKeyInText(text, entry.segments);
      if (pos) {
        const position = new vscode.Position(pos.line, pos.character);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
      }
    }),
  );

  if (inlineTranslationsEnabled) {
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => decorator.refresh(editor)),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document === vscode.window.activeTextEditor?.document) {
          debouncedDecorate();
        }
      }),
    );
  }

  const localesWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceFolder, localesGlob),
  );
  localesWatcher.onDidChange(debouncedRebuild);
  localesWatcher.onDidCreate(debouncedRebuild);
  localesWatcher.onDidDelete(debouncedRebuild);
  context.subscriptions.push(localesWatcher);

  for (const glob of codeGlobs) {
    const codeWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceFolder, glob));
    codeWatcher.onDidChange(debouncedRebuild);
    codeWatcher.onDidCreate(debouncedRebuild);
    codeWatcher.onDidDelete(debouncedRebuild);
    context.subscriptions.push(codeWatcher);
  }

  void rebuild();
}

export function deactivate(): void {}
