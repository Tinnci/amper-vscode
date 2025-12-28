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
    /**
     * Parse the dependency output from Amper CLI
     * Handles both ASCII and Unicode tree formats
     */
    private parseDependencyOutput(output: string): DependencyInfo[] {
        const lines = output.split('\n');
        const rootDependencies: DependencyInfo[] = [];
        let currentScope: string | undefined;
        let stack: { depth: number; node: DependencyInfo }[] = [];

        // Regex patterns
        const scopeRegex = /^Module\s+.*scope\s*=\s*(\w+)/i;
        const treePrefixRegex = /^([\|\s+\\─├╰]*)/;
        const dependencyRegex = /([^\s:]+:[^\s:]+:[^\s:\(]+)(?:\s+->\s+([^\s]+))?/;
        const tagsRegex = /\(([*c])\)|implicit|FAILED/;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) { continue; }

            // 1. Detect Scope
            const scopeMatch = line.match(scopeRegex);
            if (scopeMatch) {
                currentScope = scopeMatch[1].toLowerCase();
                stack = []; // Reset stack for new scope section
                continue;
            }

            // Skip metadata lines that don't look like tree items
            if (line.startsWith('Module ') || line.startsWith('Dependencies of module')) {
                continue;
            }

            // 2. Calculate Depth (handling Unicode and ASCII)
            // Each level is typically 5 characters: "│    " or "├─── " or "+--- "
            const prefixMatch = line.match(treePrefixRegex);
            if (!prefixMatch) { continue; }

            const prefix = prefixMatch[1];
            // If the line is just a vertical bar, it's a spacer line, skip it
            if (prefix.trim() === '│' && prefix.length === line.length) { continue; }

            // Only process lines that clearly contain a dependency
            if (!line.includes(':')) { continue; }

            const depth = Math.floor(prefix.length / 5);

            // 3. Parse Dependency Info
            const content = line.substring(prefix.length).trim();
            const depMatch = content.match(dependencyRegex);

            if (!depMatch) { continue; }

            const fullCoordinate = depMatch[1]; // group:artifact:version
            const conflictVersion = depMatch[2]; // version part of "-> version"

            const parts = fullCoordinate.split(':');
            if (parts.length < 3) { continue; }

            const group = parts[0];
            const artifact = parts[1];
            let version = parts[2];

            // 4. Detect Status/Tags
            let isConflict = false;
            let isTransitive = depth > 0;
            let versionInfo = version;

            if (conflictVersion) {
                versionInfo = `${version} -> ${conflictVersion}`;
                version = conflictVersion;
                // Arrow usually implies resolution change, check if it's a conflict
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

            // 5. Build Tree
            if (depth === 0) {
                rootDependencies.push(node);
                stack = [{ depth, node }];
            } else {
                // Find parent
                while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
                    stack.pop();
                }

                if (stack.length > 0) {
                    stack[stack.length - 1].node.children.push(node);
                    stack.push({ depth, node });
                } else {
                    // Fallback to root if parent lost (shouldn't happen in valid tree)
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
