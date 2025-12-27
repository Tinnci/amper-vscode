import * as vscode from 'vscode';
import * as path from 'path';
import { TaskService } from '../../application/services/TaskService';
import { AmperModule } from '../../domain/models/AmperModule';

export class AmperProjectProvider implements vscode.TreeDataProvider<AmperTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<AmperTreeItem | undefined | void> = new vscode.EventEmitter<AmperTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<AmperTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor(private taskService: TaskService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AmperTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: AmperTreeItem): Promise<AmperTreeItem[]> {
    if (!element) {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders) return [];

      const items: AmperTreeItem[] = [];
      for (const folder of folders) {
        const result = await this.taskService.getTasksForWorkspace(folder.uri.fsPath);
        if (result) {
          items.push(new ProjectItem(result.project.rootPath, folder.name));
        }
      }
      return items;
    }

    if (element instanceof ProjectItem) {
      const result = await this.taskService.getTasksForWorkspace(element.rootPath);
      if (!result) return [];
      return result.project.modules.map(m => new ModuleItem(m, element.rootPath));
    }

    return [];
  }
}

export abstract class AmperTreeItem extends vscode.TreeItem {}

class ProjectItem extends AmperTreeItem {
  constructor(public readonly rootPath: string, label: string) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'project';
    this.iconPath = new vscode.ThemeIcon('project');
  }
}

class ModuleItem extends AmperTreeItem {
  constructor(public readonly module: AmperModule, public readonly rootPath: string) {
    super(module.name, vscode.TreeItemCollapsibleState.None);
    this.description = module.type;
    this.contextValue = 'module';
    this.iconPath = new vscode.ThemeIcon('package');
    
    this.command = {
      command: 'vscode.open',
      title: 'Open module.yaml',
      arguments: [vscode.Uri.file(path.join(module.path, 'module.yaml'))]
    };
  }
}
