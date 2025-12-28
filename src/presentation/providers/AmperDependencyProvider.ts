import * as vscode from 'vscode';
import { IProcessExecutor } from '../../domain/interfaces/IProcessExecutor';

/**
 * Represents a dependency in the tree
 */
interface DependencyInfo {
    name: string;
    version?: string;
    scope?: string;
    children: DependencyInfo[];
    isConflict?: boolean;
    conflictWith?: string;
}

/**
 * Base class for dependency tree items
 */
abstract class DependencyTreeItem extends vscode.TreeItem { }

/**
 * Item representing a dependency
 */
class DependencyItem extends DependencyTreeItem {
    constructor(
        public readonly dependency: DependencyInfo,
        isTransitive: boolean = false
    ) {
        const hasChildren = dependency.children.length > 0;
        super(
            dependency.name,
            hasChildren
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );

        this.description = dependency.version || '';
        this.contextValue = 'dependency';

        // Set icon based on state
        if (dependency.isConflict) {
            this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.errorForeground'));
            this.tooltip = new vscode.MarkdownString(
                `⚠️ **Conflict Detected**\n\n` +
                `**${dependency.name}**\n\n` +
                `Version: \`${dependency.version}\`\n\n` +
                `This dependency has a version conflict that may cause build issues.`
            );
        } else if (isTransitive) {
            this.iconPath = new vscode.ThemeIcon('package', new vscode.ThemeColor('disabledForeground'));
            this.tooltip = new vscode.MarkdownString(
                `📦 **Transitive Dependency**\n\n` +
                `**${dependency.name}**\n\n` +
                `Version: \`${dependency.version}\`\n\n` +
                `${dependency.scope ? `Scope: \`${dependency.scope}\`` : ''}`
            );
        } else {
            this.iconPath = new vscode.ThemeIcon('package', new vscode.ThemeColor('charts.blue'));
            this.tooltip = new vscode.MarkdownString(
                `📦 **Direct Dependency**\n\n` +
                `**${dependency.name}**\n\n` +
                `Version: \`${dependency.version}\`\n\n` +
                `${dependency.scope ? `Scope: \`${dependency.scope}\`\n\n` : ''}` +
                `${hasChildren ? `🔗 ${dependency.children.length} transitive dependencies` : ''}`
            );
        }
    }
}

/**
 * Placeholder item when no dependencies exist
 */
class NoDependenciesItem extends DependencyTreeItem {
    constructor() {
        super('No dependencies', vscode.TreeItemCollapsibleState.None);
        this.description = 'This module has no external dependencies';
        this.iconPath = new vscode.ThemeIcon('info');
        this.contextValue = 'info';
    }
}

/**
 * Loading indicator item
 */
class LoadingItem extends DependencyTreeItem {
    constructor() {
        super('Loading dependencies...', vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('sync~spin');
        this.description = 'Amper is analyzing project...';
    }
}

/**
 * Service to fetch and parse dependency information from Amper
 */
export class DependencyService {
    constructor(private executor: IProcessExecutor) { }

    async getDependencies(workspacePath: string, moduleName?: string): Promise<DependencyInfo[]> {
        try {
            const args = ['show', 'dependencies'];
            if (moduleName) {
                args.push('-m', moduleName);
            }

            const output = await this.executor.exec('amper', args, { cwd: workspacePath });
            return this.parseDependencyOutput(output);
        } catch (error) {
            return [];
        }
    }

    private parseDependencyOutput(output: string): DependencyInfo[] {
        const lines = output.split('\n');
        const rootDependencies: DependencyInfo[] = [];
        let currentScope: string | undefined;
        let stack: { depth: number; node: DependencyInfo }[] = [];

        const scopeRegex = /^Module\s+.*scope\s*=\s*(\w+)/i;
        const treePrefixRegex = /^([\|\s+\\─├╰]*)/;
        const dependencyRegex = /([^\s:]+:[^\s:]+:[^\s:\(]+)(?:\s+->\s+([^\s]+))?/;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) { continue; }

            const scopeMatch = line.match(scopeRegex);
            if (scopeMatch) {
                currentScope = scopeMatch[1].toLowerCase();
                stack = [];
                continue;
            }

            if (line.startsWith('Module ') || line.startsWith('Dependencies of module')) {
                continue;
            }

            const prefixMatch = line.match(treePrefixRegex);
            if (!prefixMatch) { continue; }

            const prefix = prefixMatch[1];
            if (prefix.trim() === '│' && prefix.length === line.length) { continue; }
            if (!line.includes(':')) { continue; }

            const depth = Math.floor(prefix.length / 5);

            const content = line.substring(prefix.length).trim();
            const depMatch = content.match(dependencyRegex);

            if (!depMatch) { continue; }

            const fullCoordinate = depMatch[1];
            const conflictVersion = depMatch[2];

            const parts = fullCoordinate.split(':');
            if (parts.length < 3) { continue; }

            const group = parts[0];
            const artifact = parts[1];
            let version = parts[2];

            let isConflict = false;
            let versionInfo = version;

            if (conflictVersion) {
                versionInfo = `${version} -> ${conflictVersion}`;
                version = conflictVersion;
            }

            if (content.includes('FAILED')) {
                isConflict = true;
                versionInfo += ' (FAILED)';
            } else if (content.includes('(c)')) {
                versionInfo += ' (constraint)';
            } else if (content.includes('(*)')) {
                versionInfo += ' (omitted)';
            }

            const node: DependencyInfo = {
                name: `${group}:${artifact}`,
                version: versionInfo,
                scope: currentScope,
                children: [],
                isConflict
            };

            if (depth === 0) {
                rootDependencies.push(node);
                stack = [{ depth, node }];
            } else {
                while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
                    stack.pop();
                }

                if (stack.length > 0) {
                    stack[stack.length - 1].node.children.push(node);
                    stack.push({ depth, node });
                } else {
                    rootDependencies.push(node);
                    stack.push({ depth, node });
                }
            }
        }

        return rootDependencies;
    }
}

/**
 * TreeDataProvider for displaying dependencies
 */
export class AmperDependencyProvider implements vscode.TreeDataProvider<DependencyTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<DependencyTreeItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private workspacePath: string | undefined;
    private dependencies: DependencyInfo[] = [];
    private isLoading = false;

    constructor(private dependencyService: DependencyService) { }

    refresh(): void {
        this.dependencies = [];
        this.isLoading = false;
        this._onDidChangeTreeData.fire();
    }

    setWorkspace(path: string | undefined): void {
        if (this.workspacePath !== path) {
            this.workspacePath = path;
            this.refresh();
        }
    }

    getTreeItem(element: DependencyTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: DependencyTreeItem): Promise<DependencyTreeItem[]> {
        if (!this.workspacePath) {
            return [];
        }

        if (!element) {
            if (this.isLoading) {
                return [new LoadingItem()];
            }

            if (this.dependencies.length === 0) {
                this.loadDependencies();
                return [new LoadingItem()];
            }

            return this.dependencies.map(dep => new DependencyItem(dep));
        }

        if (element instanceof DependencyItem && element.dependency.children.length > 0) {
            return element.dependency.children.map(child => new DependencyItem(child, true));
        }

        return [];
    }

    private async loadDependencies(retryCount = 0): Promise<void> {
        if (this.isLoading || !this.workspacePath) {
            return;
        }

        this.isLoading = true;
        this._onDidChangeTreeData.fire();

        try {
            const deps = await this.dependencyService.getDependencies(this.workspacePath);

            if (deps.length === 0 && retryCount < 2) {
                const delay = 3000 * (retryCount + 1);
                await new Promise(resolve => setTimeout(resolve, delay));
                this.isLoading = false;
                return this.loadDependencies(retryCount + 1);
            }

            this.dependencies = deps;
        } catch (error) {
            this.dependencies = [];
        } finally {
            this.isLoading = false;
            this._onDidChangeTreeData.fire();
        }
    }
}
