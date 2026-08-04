import * as vscode from 'vscode';
import { completion, missingKeys, sourceKeys, type LocaleIndex } from './localeIndex';
import { isUsed, type UsageIndex } from './usageIndex';

type Node =
  | { kind: 'locale'; locale: string }
  | { kind: 'missingKey'; locale: string; keyPath: string }
  | { kind: 'unusedGroup' }
  | { kind: 'unusedKey'; keyPath: string }
  | { kind: 'duplicateGroup' }
  | { kind: 'duplicateKey'; keyPath: string; files: string[] };

const FLAGS: Record<string, string> = { fr: '🇫🇷', en: '🇬🇧' };
const flag = (locale: string) => FLAGS[locale] ?? '🌐';

export class BetterI18nDashboard implements vscode.TreeDataProvider<Node> {
  private readonly emitter = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(
    private getLocaleIndex: () => LocaleIndex,
    private getUsageIndex: () => UsageIndex,
  ) {}

  refresh(): void {
    this.emitter.fire(undefined);
  }

  getTreeItem(node: Node): vscode.TreeItem {
    const index = this.getLocaleIndex();

    switch (node.kind) {
      case 'locale': {
        const { total, translated } = completion(index, node.locale);
        const pct = total === 0 ? 100 : Math.round((translated / total) * 100);
        const item = new vscode.TreeItem(
          `${flag(node.locale)} ${node.locale} — ${pct}% (${translated}/${total})`,
          missingKeys(index, node.locale).length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
        );
        return item;
      }
      case 'missingKey': {
        const item = new vscode.TreeItem(node.keyPath, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('warning');
        item.command = {
          command: 'betterI18n.editValue',
          title: 'Éditer',
          arguments: [node.keyPath, node.locale],
        };
        return item;
      }
      case 'unusedGroup': {
        const unused = sourceKeys(index).filter((key) => !isUsed(this.getUsageIndex(), key));
        return new vscode.TreeItem(
          `Clés inutilisées (${unused.length})`,
          unused.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        );
      }
      case 'unusedKey': {
        const item = new vscode.TreeItem(node.keyPath, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('circle-slash');
        item.command = { command: 'betterI18n.revealKey', title: 'Révéler', arguments: [node.keyPath] };
        return item;
      }
      case 'duplicateGroup': {
        const count = index.duplicates.length;
        return new vscode.TreeItem(
          `⚠ Clés dupliquées (${count})`,
          count > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        );
      }
      case 'duplicateKey': {
        const item = new vscode.TreeItem(node.keyPath, vscode.TreeItemCollapsibleState.None);
        item.description = node.files.map((file) => file.split('/').slice(-2).join('/')).join(' vs ');
        item.iconPath = new vscode.ThemeIcon('error');
        return item;
      }
    }
  }

  getChildren(node?: Node): Node[] {
    const index = this.getLocaleIndex();

    if (!node) {
      const localeNodes: Node[] = index.locales.map((locale) => ({ kind: 'locale', locale }));
      return [...localeNodes, { kind: 'unusedGroup' }, { kind: 'duplicateGroup' }];
    }

    switch (node.kind) {
      case 'locale':
        return missingKeys(index, node.locale).map((keyPath) => ({
          kind: 'missingKey',
          locale: node.locale,
          keyPath,
        }));
      case 'unusedGroup':
        return sourceKeys(index)
          .filter((key) => !isUsed(this.getUsageIndex(), key))
          .map((keyPath) => ({ kind: 'unusedKey', keyPath }));
      case 'duplicateGroup':
        return index.duplicates.map((dup) => ({
          kind: 'duplicateKey',
          keyPath: dup.keyPath,
          files: dup.files,
        }));
      default:
        return [];
    }
  }
}
