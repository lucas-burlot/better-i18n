import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { findKeyMatchesInLine } from './usageRegex';

export interface UsageLocation {
  file: string;
  line: number;
}

export interface UsageIndex {
  byKey: Map<string, UsageLocation[]>;
}

export async function buildUsageIndex(workspaceRoot: string, codeGlobs: string[]): Promise<UsageIndex> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.find(
    (folder) => folder.uri.fsPath === workspaceRoot,
  );
  const byKey = new Map<string, UsageLocation[]>();

  for (const glob of codeGlobs) {
    const pattern = workspaceFolder
      ? new vscode.RelativePattern(workspaceFolder, glob)
      : path.join(workspaceRoot, glob);
    const uris = await vscode.workspace.findFiles(pattern);
    for (const uri of uris) {
      const filePath = uri.fsPath;
      let text: string;
      try {
        text = fs.readFileSync(filePath, 'utf8');
      } catch {
        continue;
      }
      const lines = text.split('\n');
      lines.forEach((lineText, lineIndex) => {
        for (const match of findKeyMatchesInLine(lineText)) {
          const locations = byKey.get(match.keyPath) ?? [];
          locations.push({ file: filePath, line: lineIndex });
          byKey.set(match.keyPath, locations);
        }
      });
    }
  }

  return { byKey };
}

export function isUsed(usages: UsageIndex, keyPath: string): boolean {
  return usages.byKey.has(keyPath);
}
