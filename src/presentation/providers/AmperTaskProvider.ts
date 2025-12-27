import * as vscode from 'vscode';
import { TaskService } from '../../application/services/TaskService';
import { AmperTaskType } from '../../domain/models/AmperTask';

export class AmperTaskProvider implements vscode.TaskProvider {
  static AmperType = 'amper';

  constructor(private taskService: TaskService) {}

  async provideTasks(): Promise<vscode.Task[]> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) {
      return [];
    }

    const allTasks: vscode.Task[] = [];
    for (const folder of folders) {
      const result = await this.taskService.getTasksForWorkspace(folder.uri.fsPath);
      if (!result) {
        continue;
      }

      for (const item of result.tasks) {
        allTasks.push(this.createTask(item.task.type, item.moduleName, folder));
      }
    }
    return allTasks;
  }

  resolveTask(task: vscode.Task): vscode.Task | undefined {
    return task;
  }

  private createTask(type: AmperTaskType, moduleName: string, folder: vscode.WorkspaceFolder): vscode.Task {
    const command = type.toLowerCase();
    const isWindows = process.platform === 'win32';
    const wrapper = isWindows ? '.\\amper.bat' : './amper';
    
    // Use ShellExecution with explicit cwd to ensure the wrapper is found
    const execution = new vscode.ShellExecution(`${wrapper} ${command}`, {
      cwd: folder.uri.fsPath
    });
    
    const task = new vscode.Task(
      { type: AmperTaskProvider.AmperType, task: command, module: moduleName },
      folder,
      `amper ${command} (${moduleName})`,
      AmperTaskProvider.AmperType,
      execution,
      ['$amper-kotlin']
    );

    if (type === AmperTaskType.Build) {
      task.group = vscode.TaskGroup.Build;
    } else if (type === AmperTaskType.Test) {
      task.group = vscode.TaskGroup.Test;
    } else if (type === AmperTaskType.Clean) {
      task.group = vscode.TaskGroup.Clean;
    }

    return task;
  }
}
