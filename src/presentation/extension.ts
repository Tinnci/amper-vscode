import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { NodeProcessExecutor } from '../infrastructure/adapters/NodeProcessExecutor';
import { FileSystemProjectRepository } from '../infrastructure/repositories/FileSystemProjectRepository';
import { TaskService } from '../application/services/TaskService';
import { ProjectService } from '../application/services/ProjectService';
import { AmperTaskProvider } from './providers/AmperTaskProvider';
import { AmperProjectProvider, AmperTreeItem } from './providers/AmperProjectProvider';
import { FileSystemJdkRepository } from '../infrastructure/repositories/FileSystemJdkRepository';
import { AmperJdkProvider } from './providers/AmperJdkProvider';
import { MavenCodeLensProvider } from './providers/MavenCodeLensProvider';
import { FileSystemTemplateRepository } from '../domain/repositories/ITemplateRepository';

export function activate(context: vscode.ExtensionContext) {
    // Dependency Injection
    const projectRepo = new FileSystemProjectRepository();
    const jdkRepo = new FileSystemJdkRepository();
    const executor = new NodeProcessExecutor();
    const taskService = new TaskService(projectRepo);
    const projectService = new ProjectService(executor);
    const taskProvider = new AmperTaskProvider(taskService);
    const projectProvider = new AmperProjectProvider(taskService);
    const jdkProvider = new AmperJdkProvider(jdkRepo);

    // Initialize dynamic template discovery
    const templateRepo = new FileSystemTemplateRepository(context.extensionPath);
    projectService.setTemplateRepository(templateRepo);

    const outputChannel = vscode.window.createOutputChannel('Amper');

    // Register Task Provider
    context.subscriptions.push(
        vscode.tasks.registerTaskProvider(AmperTaskProvider.AmperType, taskProvider)
    );

    // Register Tree Views
    vscode.window.registerTreeDataProvider('amperProjectExplorer', projectProvider);
    vscode.window.registerTreeDataProvider('amperJdkExplorer', jdkProvider);

    // Register CodeLens Provider
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ language: 'xml', pattern: '**/pom.xml' }, new MavenCodeLensProvider())
    );

    // Enhanced Status Bar Items
    // 1. Init button (shown when no project)
    const initStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    initStatusBar.command = 'amper-vscode.initProject';
    initStatusBar.text = '$(add) Amper Init';
    initStatusBar.tooltip = 'Initialize a new Amper project';
    context.subscriptions.push(initStatusBar);

    // 2. Project status (shown when project exists)
    const projectStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    projectStatusBar.command = 'amper-vscode.checkVersion';
    projectStatusBar.tooltip = 'Click to check Amper version';
    context.subscriptions.push(projectStatusBar);

    // Update status bar based on project state
    async function updateStatusBar() {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            initStatusBar.show();
            projectStatusBar.hide();
            return;
        }

        // Check if any workspace has Amper project
        let hasAmperProject = false;
        let totalModules = 0;

        for (const folder of folders) {
            const result = await taskService.getTasksForWorkspace(folder.uri.fsPath);
            if (result) {
                hasAmperProject = true;
                totalModules += result.project.modules.length;
            }
        }

        if (hasAmperProject) {
            initStatusBar.hide();
            projectStatusBar.text = `$(rocket) Amper: ${totalModules} module${totalModules !== 1 ? 's' : ''}`;
            projectStatusBar.show();
        } else {
            initStatusBar.show();
            projectStatusBar.hide();
        }
    }

    // Initial status bar update
    updateStatusBar();

    // Update on workspace change
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => updateStatusBar())
    );

    // Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('amper-vscode.refreshEntry', () => projectProvider.refresh()),
        vscode.commands.registerCommand('amper-vscode.refreshJdks', () => jdkProvider.refresh()),
        vscode.commands.registerCommand('amper-vscode.convertMavenProject', async (uri: vscode.Uri) => {
            const projectPath = path.dirname(uri.fsPath);

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Converting Maven project to Amper...",
                cancellable: false
            }, async () => {
                try {
                    // Note: This uses the hidden/experimental convert-project command
                    await executor.exec('amper', ['convert-project'], { cwd: projectPath });
                    vscode.window.showInformationMessage(`Project converted successfully. Check for module.yaml files.`);
                    projectProvider.refresh();
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Failed to convert project: ${err.message}. Note: This feature requires Amper 0.9.0+`);
                }
            });
        }),
        vscode.commands.registerCommand('amper-vscode.initProject', async () => {
            const templates = projectService.getTemplates();

            // Convert to QuickPick items with descriptions
            const quickPickItems = templates.map(t => ({
                label: t.label,
                description: t.id,
                detail: t.description,
                id: t.id
            }));

            const selected = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: 'Select a project template',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (!selected) {
                return;
            }

            const result = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select folder to initialize project'
            });

            if (!result || result.length === 0) {
                return;
            }

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
            if (!rootPath) {
                return;
            }

            try {
                outputChannel.show();
                outputChannel.appendLine(`Fetching tasks for module: ${moduleName}...`);
                const out = await executor.exec('amper', ['show', 'tasks'], { cwd: rootPath });
                outputChannel.appendLine(out);
            } catch (err: any) {
                vscode.window.showErrorMessage(`Failed to show tasks: ${err.message}`);
            }
        }),

        vscode.commands.registerCommand('amper-vscode.updateAmper', async () => {
            await runGlobalAmperCommand('update', 'Updating Amper...');
        }),

        vscode.commands.registerCommand('amper-vscode.cleanSharedCaches', async () => {
            await runGlobalAmperCommand('clean-shared-caches', 'Cleaning shared caches...');
        }),

        vscode.commands.registerCommand('amper-vscode.cleanBootstrapCache', async () => {
            const confirm = await vscode.window.showWarningMessage(
                'This will delete the Amper bootstrap cache (JREs and Amper distributions). Amper will re-download them on the next run. Continue?',
                'Yes', 'No'
            );
            if (confirm !== 'Yes') {
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Cleaning Amper bootstrap cache...",
                cancellable: false
            }, async () => {
                try {
                    const cachePath = jdkRepo.getAmperCachePath();
                    if (fs.existsSync(cachePath)) {
                        // Use fs.rmSync for recursive delete (Node 14.14+)
                        fs.rmSync(cachePath, { recursive: true, force: true });
                        vscode.window.showInformationMessage('Amper bootstrap cache cleaned successfully.');
                        jdkProvider.refresh();
                    } else {
                        vscode.window.showInformationMessage('Amper bootstrap cache is already empty.');
                    }
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Failed to clean cache: ${err.message}`);
                }
            });
        }),

        vscode.commands.registerCommand('amper-vscode.showJdkInfo', async () => {
            const folders = vscode.workspace.workspaceFolders;
            if (!folders || folders.length === 0) {
                vscode.window.showWarningMessage('No workspace folder open.');
                return;
            }
            const cwd = folders[0].uri.fsPath;

            try {
                outputChannel.show();
                outputChannel.appendLine('Fetching JDK information...');
                const out = await projectService.getJdkInfo(cwd);
                outputChannel.appendLine(out);
            } catch (err: any) {
                vscode.window.showErrorMessage(`Failed to get JDK info: ${err.message}`);
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
            const out = await executor.exec('amper', ['--version'], { cwd });
            vscode.window.showInformationMessage(`Amper version: ${out}`);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to get Amper version: ${msg}`);
        }
    });

    context.subscriptions.push(disposable);

    async function runGlobalAmperCommand(command: string, progressTitle: string) {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            vscode.window.showWarningMessage('No workspace folder open.');
            return;
        }
        const cwd = folders[0].uri.fsPath;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: progressTitle,
            cancellable: false
        }, async () => {
            try {
                await executor.exec('amper', [command], { cwd });
                vscode.window.showInformationMessage(`Amper ${command} completed successfully.`);
            } catch (err: any) {
                vscode.window.showErrorMessage(`Amper ${command} failed: ${err.message}`);
            }
        });
    }
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

export function deactivate() { }
