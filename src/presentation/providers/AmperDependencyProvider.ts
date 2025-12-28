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
 * Service to fetch and parse dependency information from Amper
 */
export class DependencyService {
    constructor(private executor: IProcessExecutor) { }

    /**
     * Get dependencies for a module in a workspace
     */
    async getDependencies(workspacePath: string, moduleName?: string): Promise<DependencyInfo[]> {
        try {
            const args = ['show', 'dependencies'];
            if (moduleName) {
                args.push('-m', moduleName);
            }

            const output = await this.executor.exec('amper', args, { cwd: workspacePath });
            return this.parseDependencyOutput(output);
        } catch (error) {
            // Return empty array if command fails
            return [];
        }
    }

    /**
     * Parse the dependency output from Amper CLI
     * Format example:
     * +--- org.jetbrains.kotlin:kotlin-stdlib:1.9.0
     * |    +--- org.jetbrains.kotlin:kotlin-stdlib-common:1.9.0
     * |    \--- org.jetbrains:annotations:13.0
     * \--- org.example:my-lib:1.0.0
     */
    private parseDependencyOutput(output: string): DependencyInfo[] {
        const lines = output.split('\n').filter(line => line.trim());
        const root: DependencyInfo[] = [];
        const stack: { depth: number; node: DependencyInfo }[] = [];

        for (const line of lines) {
            // Skip header lines
            if (!line.includes('---') && !line.includes(':')) {
                continue;
            }

            // Calculate depth based on indentation (each level is 5 chars: "|    " or "+--- ")
            const match = line.match(/^([\|\s+\\-]*)(.*)/);
            if (!match) {
                continue;
            }

            const [, prefix, content] = match;
            const depth = Math.floor(prefix.length / 5);

            // Parse dependency string (format: group:artifact:version)
            const depMatch = content.trim().match(/^([^:]+):([^:]+):([^\s(]+)(\s*\(.*\))?/);
            if (!depMatch) {
                continue;
            }

            const [, group, artifact, version, extra] = depMatch;
            const isConflict = extra?.includes('conflict') || extra?.includes('FAILED');

            const node: DependencyInfo = {
                name: `${group}:${artifact}`,
                version,
                children: [],
                isConflict
            };

            // Find parent based on depth
            while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
                stack.pop();
            }

            if (stack.length === 0) {
                root.push(node);
            } else {
                stack[stack.length - 1].node.children.push(node);
            }

            stack.push({ depth, node });
        }

        return root;
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
        this._onDidChangeTreeData.fire();
    }

    setWorkspace(path: string | undefined): void {
        this.workspacePath = path;
        this.refresh();
    }

    getTreeItem(element: DependencyTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: DependencyTreeItem): Promise<DependencyTreeItem[]> {
        if (!this.workspacePath) {
            return [];
        }

        if (!element) {
            // Root level - fetch dependencies
            if (!this.isLoading) {
                this.isLoading = true;
                try {
                    this.dependencies = await this.dependencyService.getDependencies(this.workspacePath);
                } finally {
                    this.isLoading = false;
                }
            }

            if (this.dependencies.length === 0) {
                return [new NoDependenciesItem()];
            }

            return this.dependencies.map(dep => new DependencyItem(dep));
        }

        // Child level
        if (element instanceof DependencyItem && element.dependency.children.length > 0) {
            return element.dependency.children.map(child => new DependencyItem(child, true));
        }

        return [];
    }
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
            this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
            this.tooltip = new vscode.MarkdownString(
                `⚠️ **Conflict Detected**\n\n` +
                `**${dependency.name}**\n\n` +
                `Version: \`${dependency.version}\`\n\n` +
                `This dependency has a version conflict.`
            );
        } else if (isTransitive) {
            this.iconPath = new vscode.ThemeIcon('package', new vscode.ThemeColor('charts.gray'));
            this.tooltip = new vscode.MarkdownString(
                `📦 **Transitive Dependency**\n\n` +
                `**${dependency.name}**\n\n` +
                `Version: \`${dependency.version}\``
            );
        } else {
            this.iconPath = new vscode.ThemeIcon('package', new vscode.ThemeColor('charts.blue'));
            this.tooltip = new vscode.MarkdownString(
                `📦 **Direct Dependency**\n\n` +
                `**${dependency.name}**\n\n` +
                `Version: \`${dependency.version}\`\n\n` +
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
