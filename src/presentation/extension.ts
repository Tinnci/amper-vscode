import * as vscode from 'vscode';
import { NodeProcessExecutor } from '../infrastructure/adapters/NodeProcessExecutor';
import { FileSystemProjectRepository } from '../infrastructure/repositories/FileSystemProjectRepository';
import { TaskService } from '../application/services/TaskService';
import { ProjectService } from '../application/services/ProjectService';
import { AmperTaskProvider } from './providers/AmperTaskProvider';
import { AmperProjectProvider, AmperTreeItem } from './providers/AmperProjectProvider';

export function activate(context: vscode.ExtensionContext) {
  // Dependency Injection
  const projectRepo = new FileSystemProjectRepository();
  const executor = new NodeProcessExecutor();
  const taskService = new TaskService(projectRepo);
  const projectService = new ProjectService(executor);
  const taskProvider = new AmperTaskProvider(taskService);
  const projectProvider = new AmperProjectProvider(taskService);

  const outputChannel = vscode.window.createOutputChannel('Amper');

  // Register Task Provider
  context.subscriptions.push(
    vscode.tasks.registerTaskProvider(AmperTaskProvider.AmperType, taskProvider)
  );

  // Register Tree View
  vscode.window.registerTreeDataProvider('amperProjectExplorer', projectProvider);

  // Status Bar Item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'amper-vscode.initProject';
  statusBarItem.text = '$(rocket) Amper Init';
  statusBarItem.tooltip = 'Initialize a new Amper project';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('amper-vscode.refreshEntry', () => projectProvider.refresh()),
    
    vscode.commands.registerCommand('amper-vscode.initProject', async () => {
      const templates = projectService.getTemplates();
      const selected = await vscode.window.showQuickPick(templates, {
        placeHolder: 'Select a project template'
      });

      if (!selected) return;

      const result = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select folder to initialize project'
      });

      if (!result || result.length === 0) return;

      const projectPath = result[0].fsPath;

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Initializing Amper project: ${selected.label}`,
        cancellable: false
      }, async (progress) => {
        try {
          progress.report({ message: 'Downloading wrapper...' });
          await projectService.initializeProject(projectPath, selected.id);
          vscode.window.showInformationMessage(`Project initialized successfully in ${projectPath}`);
          
          // Ask to open the folder
          const open = await vscode.window.showInformationMessage('Open the new project?', 'Yes', 'No');
          if (open === 'Yes') {
            vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath));
          }
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to initialize project: ${err.message}`);
        }
      });
    }),

    vscode.commands.registerCommand('amper-vscode.runModule', async (item: any) => {
      await executeAmperTask('run', item);
    }),
    
    vscode.commands.registerCommand('amper-vscode.testModule', async (item: any) => {
      await executeAmperTask('test', item);
    }),
    
    vscode.commands.registerCommand('amper-vscode.buildModule', async (item: any) => {
      await executeAmperTask('build', item);
    }),

    vscode.commands.registerCommand('amper-vscode.cleanModule', async (item: any) => {
      await executeAmperTask('clean', item);
    }),

    vscode.commands.registerCommand('amper-vscode.showTasks', async (item: any) => {
      const moduleName = item?.module?.name;
      const rootPath = item?.rootPath;
      if (!rootPath) return;

      try {
        outputChannel.show();
        outputChannel.appendLine(`Fetching tasks for module: ${moduleName}...`);
        const out = await executor.exec('amper', ['show', 'tasks'], rootPath);
        outputChannel.appendLine(out);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to show tasks: ${err.message}`);
      }
    })
  );

  const disposable = vscode.commands.registerCommand('amper-vscode.checkVersion', async () => {
    try {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        vscode.window.showWarningMessage('No workspace folder open.');
        return;
      }
      const cwd = folders[0].uri.fsPath;
      const out = await executor.exec('amper', ['--version'], cwd);
      vscode.window.showInformationMessage(`Amper version: ${out}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to get Amper version: ${msg}`);
    }
  });

  context.subscriptions.push(disposable);
}

async function executeAmperTask(command: string, item: any) {
  const tasks = await vscode.tasks.fetchTasks({ type: 'amper' });
  // The item is a ModuleItem from our TreeView
  const moduleName = item?.module?.name;
  
  const task = tasks.find(t => t.definition.task === command && t.definition.module === moduleName);
  if (task) {
    await vscode.tasks.executeTask(task);
  } else {
    vscode.window.showErrorMessage(`Could not find amper ${command} task for module ${moduleName}`);
  }
}

export function deactivate() {}
