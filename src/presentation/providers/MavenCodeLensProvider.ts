import * as vscode from 'vscode';

export class MavenCodeLensProvider implements vscode.CodeLensProvider {
    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
        const lenses: vscode.CodeLens[] = [];

        // Only for pom.xml
        if (document.fileName.endsWith('pom.xml')) {
            const range = new vscode.Range(0, 0, 0, 0);
            lenses.push(new vscode.CodeLens(range, {
                title: "$(rocket) Convert to Amper",
                command: "amper-vscode.convertMavenProject",
                arguments: [document.uri]
            }));
        }

        return lenses;
    }
}
