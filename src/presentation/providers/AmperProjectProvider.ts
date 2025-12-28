import * as vscode from 'vscode';
import * as path from 'path';
import { TaskService } from '../../application/services/TaskService';
import { AmperModule } from '../../domain/models/AmperModule';

/**
 * Map module types to appropriate VS Code theme icons
 */
function getModuleIcon(moduleType: string): vscode.ThemeIcon {
  const type = moduleType.toLowerCase();

  // Android icons
  if (type.includes('android')) {
    return new vscode.ThemeIcon('device-mobile', new vscode.ThemeColor('debugIcon.startForeground'));
  }

  // iOS icons
  if (type.includes('ios')) {
    return new vscode.ThemeIcon('device-mobile', new vscode.ThemeColor('charts.blue'));
  }

  // Desktop/GUI apps
  if (type.includes('desktop') || type.includes('gui')) {
    return new vscode.ThemeIcon('window', new vscode.ThemeColor('charts.purple'));
  }

  // Server/Ktor apps
  if (type.includes('server') || type.includes('ktor') || type.includes('backend')) {
    return new vscode.ThemeIcon('server-process', new vscode.ThemeColor('charts.orange'));
  }

  // CLI/Console apps
  if (type.includes('cli') || type.includes('console')) {
    return new vscode.ThemeIcon('terminal', new vscode.ThemeColor('terminal.ansiCyan'));
  }

  // Libraries (common/lib)
  if (type.includes('lib') && !type.includes('jvm')) {
    return new vscode.ThemeIcon('package', new vscode.ThemeColor('charts.yellow'));
  }

  // JVM apps/libs
  if (type.includes('jvm')) {
    const isApp = type.includes('app');
    return new vscode.ThemeIcon(isApp ? 'coffee' : 'library', new vscode.ThemeColor('charts.red'));
  }

  // Amper Plugins
  if (type.includes('plugin')) {
    return new vscode.ThemeIcon('extensions', new vscode.ThemeColor('charts.purple'));
  }

  // Default
  return new vscode.ThemeIcon('file-submodule', new vscode.ThemeColor('charts.foreground'));
}

/**
 * Get a display-friendly product type name
 */
function getProductTypeLabel(moduleType: string): string {
  const typeMap: Record<string, string> = {
    'jvm/app': '☕ JVM App',
    'jvm/lib': '📚 JVM Library',
    'android/app': '🤖 Android App',
    'ios/app': '🍎 iOS App',
    'lib': '📦 Multiplatform Library',
    'jvm/amper-plugin': '🔌 Amper Plugin'
  };
  return typeMap[moduleType] || moduleType;
}

export class AmperProjectProvider implements vscode.TreeDataProvider<AmperTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<AmperTreeItem | undefined | void> = new vscode.EventEmitter<AmperTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<AmperTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor(private taskService: TaskService) { }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AmperTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: AmperTreeItem): Promise<AmperTreeItem[]> {
    if (!element) {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders) {
        return [];
      }

      const items: AmperTreeItem[] = [];
      for (const folder of folders) {
        const result = await this.taskService.getTasksForWorkspace(folder.uri.fsPath);
        if (result) {
          items.push(new ProjectItem(result.project.rootPath, folder.name, result.project.modules.length));
        }
      }
      return items;
    }

    if (element instanceof ProjectItem) {
      const result = await this.taskService.getTasksForWorkspace(element.rootPath);
      if (!result) {
        return [];
      }
      return result.project.modules.map(m => new ModuleItem(m, element.rootPath));
    }

    return [];
  }
}

export abstract class AmperTreeItem extends vscode.TreeItem { }

class ProjectItem extends AmperTreeItem {
  constructor(
    public readonly rootPath: string,
    label: string,
    moduleCount: number
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'project';
    this.iconPath = new vscode.ThemeIcon('rocket', new vscode.ThemeColor('charts.blue'));
    this.description = `${moduleCount} module${moduleCount !== 1 ? 's' : ''}`;
    this.tooltip = new vscode.MarkdownString(`**Amper Project**\n\n📁 ${rootPath}\n\n📦 ${moduleCount} modules`);
  }
}

class ModuleItem extends AmperTreeItem {
  constructor(
    public readonly module: AmperModule,
    public readonly rootPath: string
  ) {
    super(module.name, vscode.TreeItemCollapsibleState.None);
    this.description = getProductTypeLabel(module.type);
    this.contextValue = 'module';
    this.iconPath = getModuleIcon(module.type);

    // Rich tooltip with module info
    this.tooltip = new vscode.MarkdownString(
      `**${module.name}**\n\n` +
      `📦 Type: \`${module.type}\`\n\n` +
      `📁 Path: \`${module.path}\`\n\n` +
      `---\n\n` +
      `*Click to open module.yaml*`
    );

    this.command = {
      command: 'vscode.open',
      title: 'Open module.yaml',
      arguments: [vscode.Uri.file(path.join(module.path, 'module.yaml'))]
    };
  }
}
