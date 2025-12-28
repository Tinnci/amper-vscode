import * as vscode from 'vscode';
import { FileSystemJdkRepository } from '../../infrastructure/repositories/FileSystemJdkRepository';
import { JdkInfo } from '../../domain/models/JdkInfo';

export class AmperJdkProvider implements vscode.TreeDataProvider<JdkItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<JdkItem | undefined | void> = new vscode.EventEmitter<JdkItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<JdkItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private jdkRepo: FileSystemJdkRepository) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: JdkItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: JdkItem): Promise<JdkItem[]> {
        if (element) {
            return [];
        }

        const jdks = await this.jdkRepo.getInstalledJdks();
        return jdks.map(jdk => new JdkItem(jdk));
    }
}

class JdkItem extends vscode.TreeItem {
    constructor(public readonly jdk: JdkInfo) {
        super(jdk.name, vscode.TreeItemCollapsibleState.None);
        this.description = `${jdk.type} ${jdk.version}`;
        this.tooltip = jdk.path;
        this.contextValue = 'jdk';
        this.iconPath = new vscode.ThemeIcon('library');
    }
}
