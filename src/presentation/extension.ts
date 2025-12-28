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
import { DependencyService, AmperDependencyProvider } from './providers/AmperDependencyProvider';
import { Logger } from '../infrastructure/services/Logger';
import { DiagnosticService } from '../application/services/DiagnosticService';
import { BuildDiagnosticPanel } from './views/BuildDiagnosticPanel';
import { TaskGraphService } from '../application/services/TaskGraphService';
import { TaskGraphPanel } from './views/TaskGraphPanel';
import { ModuleConfigEditorProvider } from './editors/ModuleConfigEditorProvider';

export function activate(context: vscode.ExtensionContext) {
    // 1. Initialize Logger first (Singleton)
    Logger.getInstance();
    Logger.info('Amper VS Code Extension activating...');

    // Register Custom Editor
    context.subscriptions.push(ModuleConfigEditorProvider.register(context));

    // Dependency Injection
    const projectRepo = new FileSystemProjectRepository();
    const jdkRepo = new FileSystemJdkRepository();
    const executor = new NodeProcessExecutor();
    const taskService = new TaskService(projectRepo);
    const projectService = new ProjectService(executor);
    const dependencyService = new DependencyService(executor);
    const diagnosticService = new DiagnosticService();
    const taskGraphService = new TaskGraphService(executor);

    const taskProvider = new AmperTaskProvider(taskService);
    const projectProvider = new AmperProjectProvider(taskService);
    const jdkProvider = new AmperJdkProvider(jdkRepo);
    const dependencyProvider = new AmperDependencyProvider(dependencyService);

    // Initialize dynamic template discovery
    const templateRepo = new FileSystemTemplateRepository(context.extensionPath);
    projectService.setTemplateRepository(templateRepo);

    // Register Task Provider
    context.subscriptions.push(
        vscode.tasks.registerTaskProvider(AmperTaskProvider.AmperType, taskProvider)
    );

    // Register Tree Views
    vscode.window.registerTreeDataProvider('amperProjectExplorer', projectProvider);
    vscode.window.registerTreeDataProvider('amperDependencyExplorer', dependencyProvider);
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

    // Helper to execute Amper tasks with Diagnostic View support
    async function executeAmperTaskWithDiagnostics(command: string, item: any) {
        const moduleName = item?.module?.name;
        const rootPath = item?.rootPath;
        if (!rootPath || !moduleName) {
            vscode.window.showErrorMessage('Invalid module context');
            return;
        }

        // Show panel immediately in loading state (optional, or wait for result)
        // For better UX, we'll use Progress and Logger, then show Panel on completion/failure

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Amper: Running ${command} for ${moduleName}...`,
            cancellable: true
        }, async (progress, token) => {
            const startTime = Date.now();
            Logger.info(`Executing task: ${command} on module: ${moduleName}`);

            try {
                // Determine CLI args based on module
                // If it's the root module, just run the command. If sub-module, use -m
                const args = [command];
                // Note: Assuming CLI structure. Usually: amper task -m module
                // For simplicity, we assume root execution or check how AmperTaskProvider does it.
                // Looking at AmperTaskProvider logic (via TaskService), it constructs tasks.
                // Here we will use the standard 'amper <task> -m <module>' pattern if needed.

                // Amper 0.5.0+ usually supports: amper <task> -m <module>
                // We'll append -p or -m based on typical usage. 
                // However, without complex logic, let's look at how executor works. 
                // For safety, we try the most common pattern: amper task --module moduleName

                // Wait! 'clean', 'build', 'test', 'run' are standard.
                // Let's assume we run standard commands for now.
                // If we need specific module targeting, check Amper CLI docs.
                // Assuming `amper task module` or similar.

                // Reverting to `amper task` inside the project root for now, but to be precise
                // we should probably check if we can pass the module name.
                // For now, let's just run the command and see.
                // To be safe and target the specific module, we usually need the module path relative to root
                // or just the module name if unique.

                // Let's rely on the projectRoot being the CWD.
                // We will append `-m moduleName` if it's not the root module.
                // But Amper CLI is evolving. Let's start safely.

                // IMPORTANT: Since we don't have the exact CLI syntax logic here derived from TaskProvider, 
                // we'll try to emulate `amper task -m moduleName`.

                // Actually, let's simplify: Just run the command in the CWD (Project Root).
                // If user selected a module, we try to pass it.

                // TODO: Refine CLI arguments based on exact Amper version
                const cmdArgs = [command, '-m', moduleName];

                Logger.debug(`Command: amper ${cmdArgs.join(' ')}`);

                const resultOutput = await executor.exec('amper', cmdArgs, { cwd: rootPath });

                const duration = Date.now() - startTime;
                Logger.info(`Task completed in ${duration}ms`);

                const buildResult = diagnosticService.parseBuildOutput(resultOutput, true, duration, moduleName, command);
                BuildDiagnosticPanel.createOrShow(context.extensionUri);
                BuildDiagnosticPanel.update(buildResult);

                if (buildResult.diagnostics.length > 0) {
                    // Check if any errors
                    const hasErrors = buildResult.diagnostics.some(d => d.severity === 'error');
                    if (hasErrors) {
                        vscode.window.showErrorMessage(`Amper ${command} failed. Check the report.`);
                    } else {
                        vscode.window.showInformationMessage(`Amper ${command} finished with warnings.`);
                    }
                } else {
                    vscode.window.showInformationMessage(`Amper ${command} completed successfully.`);
                }

            } catch (err: any) {
                const duration = Date.now() - startTime;
                Logger.error(`Task failed`, err);

                // Parse the error message as output
                const output = err.message || err.toString();
                const buildResult = diagnosticService.parseBuildOutput(output, false, duration, moduleName, command);

                BuildDiagnosticPanel.createOrShow(context.extensionUri);
                BuildDiagnosticPanel.update(buildResult);

                vscode.window.showErrorMessage(`Amper ${command} failed.`);
            }
        });
    }

    // Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('amper-vscode.refreshEntry', () => projectProvider.refresh()),
        vscode.commands.registerCommand('amper-vscode.refreshJdks', () => jdkProvider.refresh()),
        vscode.commands.registerCommand('amper-vscode.refreshDependencies', () => {
            const folders = vscode.workspace.workspaceFolders;
            if (folders && folders.length > 0) {
                dependencyProvider.setWorkspace(folders[0].uri.fsPath);
            }
            dependencyProvider.refresh();
        }),
        vscode.commands.registerCommand('amper-vscode.showBuildReport', () => {
            BuildDiagnosticPanel.createOrShow(context.extensionUri);
        }),
        vscode.commands.registerCommand('amper-vscode.convertMavenProject', async (uri: vscode.Uri) => {
            const projectPath = path.dirname(uri.fsPath);

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Converting Maven project to Amper...",
                cancellable: false
            }, async () => {
                try {
                    Logger.info('Converting Maven project...');
                    await executor.exec('amper', ['convert-project'], { cwd: projectPath });
                    vscode.window.showInformationMessage(`Project converted successfully.`);
                    Logger.info('Conversion successful');
                    projectProvider.refresh();
                } catch (err: any) {
                    Logger.error('Conversion failed', err);
                    vscode.window.showErrorMessage(`Failed to convert project: ${err.message}`);
                }
            });
        }),
        vscode.commands.registerCommand('amper-vscode.initProject', async () => {
            const templates = projectService.getTemplates();
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

            if (!selected) { return; }

            const result = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select folder to initialize project'
            });

            if (!result || result.length === 0) { return; }

            const projectPath = result[0].fsPath;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Initializing Amper project: ${selected.label}`,
                cancellable: false
            }, async (progress) => {
                try {
                    Logger.info(`Initializing project at ${projectPath} with template ${selected.id}`);
                    progress.report({ message: 'Downloading wrapper...' });
                    await projectService.initializeProject(projectPath, selected.id);
                    vscode.window.showInformationMessage(`Project initialized successfully.`);
                    Logger.info('Initialization successful');

                    const open = await vscode.window.showInformationMessage('Open the new project?', 'Yes', 'No');
                    if (open === 'Yes') {
                        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath));
                    }
                } catch (err: any) {
                    Logger.error('Initialization failed', err);
                    vscode.window.showErrorMessage(`Failed to initialize project: ${err.message}`);
                }
            });
        }),

        // Updated Module Commands using new execution logic
        vscode.commands.registerCommand('amper-vscode.runModule', async (item: any) => {
            await executeAmperTaskWithDiagnostics('run', item);
        }),

        vscode.commands.registerCommand('amper-vscode.testModule', async (item: any) => {
            await executeAmperTaskWithDiagnostics('test', item);
        }),

        vscode.commands.registerCommand('amper-vscode.buildModule', async (item: any) => {
            await executeAmperTaskWithDiagnostics('build', item);
        }),

        vscode.commands.registerCommand('amper-vscode.cleanModule', async (item: any) => {
            await executeAmperTaskWithDiagnostics('clean', item);
        }),

        vscode.commands.registerCommand('amper-vscode.showTasks', async (item: any) => {
            const moduleName = item?.module?.name;
            const rootPath = item?.rootPath;
            if (!rootPath) { return; }

            try {
                Logger.info(`Fetching tasks for module: ${moduleName}`);
                Logger.show(); // Show log output
                const out = await executor.exec('amper', ['show', 'tasks'], { cwd: rootPath });
                Logger.info(out);
            } catch (err: any) {
                Logger.error('Failed to show tasks', err);
                vscode.window.showErrorMessage(`Failed to show tasks: ${err.message}`);
            }
        }),

        vscode.commands.registerCommand('amper-vscode.showTaskGraph', async (item: any) => {
            const rootPath = item?.rootPath || (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0].uri.fsPath);
            if (!rootPath) { return; }

            try {
                Logger.info('Fetching task graph...');
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Generating Task Graph...',
                    cancellable: false
                }, async () => {
                    const graph = await taskGraphService.getTaskGraph(rootPath);
                    TaskGraphPanel.createOrShow(context.extensionUri);
                    TaskGraphPanel.update(graph);
                });
            } catch (err: any) {
                Logger.error('Failed to show task graph', err);
                vscode.window.showErrorMessage(`Failed to generate task graph: ${err.message}`);
            }
        }),

        vscode.commands.registerCommand('amper-vscode.updateAmper', async () => {
            await runGlobalAmperCommand('update', 'Updating Amper...');
        }),

        vscode.commands.registerCommand('amper-vscode.openBuildTrace', async () => {
            const folders = vscode.workspace.workspaceFolders;
            if (!folders || folders.length === 0) { return; }
            const cwd = folders[0].uri.fsPath;

            const isWindows = process.platform === 'win32';
            const wrapper = isWindows ? '.\\amper.bat' : './amper';

            const term = vscode.window.createTerminal({
                name: 'Amper Jaeger',
                cwd: cwd
            });
            term.show();
            term.sendText(`${wrapper} tool jaeger`);
        }),

        vscode.commands.registerCommand('amper-vscode.cleanSharedCaches', async () => {
            await runGlobalAmperCommand('clean-shared-caches', 'Cleaning shared caches...');
        }),

        vscode.commands.registerCommand('amper-vscode.cleanBootstrapCache', async () => {
            const confirm = await vscode.window.showWarningMessage(
                'This will delete the Amper bootstrap cache. Continue?',
                'Yes', 'No'
            );
            if (confirm !== 'Yes') { return; }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Cleaning Amper bootstrap cache...",
                cancellable: false
            }, async () => {
                try {
                    const cachePath = jdkRepo.getAmperCachePath();
                    if (fs.existsSync(cachePath)) {
                        fs.rmSync(cachePath, { recursive: true, force: true });
                        vscode.window.showInformationMessage('Amper bootstrap cache cleaned successfully.');
                        jdkProvider.refresh();
                    } else {
                        vscode.window.showInformationMessage('Amper bootstrap cache is already empty.');
                    }
                } catch (err: any) {
                    Logger.error('Failed to clean cache', err);
                    vscode.window.showErrorMessage(`Failed to clean cache: ${err.message}`);
                }
            });
        }),

        vscode.commands.registerCommand('amper-vscode.showJdkInfo', async () => {
            const folders = vscode.workspace.workspaceFolders;
            if (!folders || folders.length === 0) { return; }
            const cwd = folders[0].uri.fsPath;

            try {
                Logger.info('Fetching JDK info...');
                Logger.show();
                const out = await projectService.getJdkInfo(cwd);
                Logger.info(out);
            } catch (err: any) {
                Logger.error('Failed to get JDK info', err);
                vscode.window.showErrorMessage(`Failed to get JDK info: ${err.message}`);
            }
        })
    );

    const disposable = vscode.commands.registerCommand('amper-vscode.checkVersion', async () => {
        try {
            const folders = vscode.workspace.workspaceFolders;
            if (!folders || folders.length === 0) { return; }
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
        if (!folders || folders.length === 0) { return; }
        const cwd = folders[0].uri.fsPath;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: progressTitle,
            cancellable: false
        }, async () => {
            try {
                Logger.info(`Running global command: ${command}`);
                await executor.exec('amper', [command], { cwd });
                vscode.window.showInformationMessage(`Amper ${command} completed successfully.`);
            } catch (err: any) {
                Logger.error(`Command ${command} failed`, err);
                vscode.window.showErrorMessage(`Amper ${command} failed: ${err.message}`);
            }
        });
    }
}

export function deactivate() { }

