import * as vscode from 'vscode';

export class ModuleCodeLensProvider implements vscode.CodeLensProvider {
    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
        const lenses: vscode.CodeLens[] = [];

        // 始终在文件顶部添加一个 CodeLens
        const range = new vscode.Range(0, 0, 0, 0);
        lenses.push(new vscode.CodeLens(range, {
            title: "$(layout-panel) Open Amper Visual Editor",
            command: "amper-vscode.openModuleEditor",
            arguments: [document.uri]
        }));

        return lenses;
    }
}
