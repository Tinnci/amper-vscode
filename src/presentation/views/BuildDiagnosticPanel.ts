import * as vscode from 'vscode';
import { BuildResult, DiagnosticSeverity } from '../../domain/models/BuildDiagnostic';
import { Logger } from '../../infrastructure/services/Logger';

export class BuildDiagnosticPanel {
    public static currentPanel: BuildDiagnosticPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'openFile':
                        this.openFile(message.file, message.line, message.column);
                        return;
                    case 'openLink':
                        vscode.env.openExternal(vscode.Uri.parse(message.url));
                        return;
                }
            },
            null,
            this._disposables
        );

        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
    }

    private async openFile(file: string, line: number, column: number) {
        try {
            const uri = vscode.Uri.file(file);
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

            // Highlight the range
            if (line > 0) {
                // VS Code lines are 0-indexed, Amper are 1-indexed
                const lineIndex = line - 1;
                const colIndex = column > 0 ? column - 1 : 0;
                const pos = new vscode.Position(lineIndex, colIndex);
                const range = new vscode.Range(pos, pos);

                editor.selection = new vscode.Selection(pos, pos);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            }
        } catch (e: any) {
            vscode.window.showErrorMessage(`Could not open file: ${file}. Error: ${e.message}`);
        }
    }

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (BuildDiagnosticPanel.currentPanel) {
            BuildDiagnosticPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            'amperBuildReport',
            'Amper Build Report',
            column || vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')]
            }
        );

        BuildDiagnosticPanel.currentPanel = new BuildDiagnosticPanel(panel, extensionUri);
    }

    public static update(result: BuildResult) {
        if (BuildDiagnosticPanel.currentPanel) {
            BuildDiagnosticPanel.currentPanel._update(result);
        }
    }

    public dispose() {
        BuildDiagnosticPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update(result: BuildResult) {
        this._panel.webview.postMessage({ command: 'update', result });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Amper Build Report</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
        }
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .status {
            font-size: 1.2em;
            font-weight: bold;
            padding: 5px 10px;
            border-radius: 4px;
        }
        .status.success {
            background-color: var(--vscode-testing-iconPassed);
            color: white;
        }
        .status.failed {
            background-color: var(--vscode-testing-iconFailed);
            color: white;
        }
        .diagnostic-card {
            background-color: var(--vscode-notifications-background);
            border: 1px solid var(--vscode-notifications-border);
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 4px;
            border-left: 4px solid transparent;
        }
        .diagnostic-card.error {
            border-left-color: var(--vscode-testing-iconFailed);
        }
        .diagnostic-card.warning {
            border-left-color: var(--vscode-debugIcon-pauseForeground);
        }
        .file-link {
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            text-decoration: underline;
            font-family: monospace;
        }
        .related-link {
            display: inline-block;
            margin-top: 5px;
            padding: 2px 8px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            text-decoration: none;
            border-radius: 3px;
            font-size: 0.9em;
            cursor: pointer;
        }
        .related-link:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .message {
            margin-top: 5px;
            white-space: pre-wrap;
        }
        .raw-output {
            margin-top: 30px;
            border-top: 1px solid var(--vscode-textBlockQuote-border);
            padding-top: 10px;
        }
        details > summary {
            cursor: pointer;
            color: var(--vscode-descriptionForeground);
        }
        pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 10px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <div id="content">
        <div class="header">
            <h2>Build Not Started</h2>
        </div>
        <p>Run an Amper task to see the diagnostic report here.</p>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'update') {
                updateContent(message.result);
            }
        });

        function openFile(file, line, col) {
            vscode.postMessage({
                command: 'openFile',
                file: file,
                line: line,
                column: col
            });
        }

        function openLink(url) {
            vscode.postMessage({
                command: 'openLink',
                url: url
            });
        }

        function updateContent(result) {
            const content = document.getElementById('content');
            const statusClass = result.success ? 'success' : 'failed';
            const statusText = result.success ? 'BUILD SUCCESSFUL' : 'BUILD FAILED';
            const duration = (result.duration / 1000).toFixed(2);
            
            let diagnosticsHtml = '';
            
            if (result.diagnostics.length === 0 && !result.success) {
                // If failed but no specific diagnostics parsed, show raw output hint
                diagnosticsHtml = '<p>Check the raw output below for details.</p>';
            } else {
                diagnosticsHtml = result.diagnostics.map(d => {
                    const icon = d.severity === 'error' ? '🛑' : '⚠️';
                    
                    let actionsHtml = '';
                    if (d.relatedLink) {
                        actionsHtml = \`<div style="margin-top: 8px;">
                            <span class="related-link" onclick="openLink('\${d.relatedLink}')">💡 Fix / Documentation</span>
                        </div>\`;
                    }

                    return \`
                        <div class="diagnostic-card \${d.severity}">
                            <div class="title">
                                \${icon} <strong>\${d.message}</strong>
                            </div>
                            \${d.file ? \`<div class="location">
                                📄 <span class="file-link" onclick="openFile('\${escapeHtml(d.file)}', \${d.line || 0}, \${d.column || 0})">\${escapeHtml(d.file)}:\${d.line || 1}</span>
                            </div>\` : ''}
                            \${actionsHtml}
                        </div>
                    \`;
                }).join('');
            }

            content.innerHTML = \`
                <div class="header">
                    <h2>Task: \${result.taskName || 'Unknown'}</h2>
                    <span class="status \${statusClass}">\${statusText}</span>
                </div>
                <p><strong>Module:</strong> \${result.moduleName || 'Project'}</p>
                <p><strong>Duration:</strong> \${duration}s</p>
                
                <h3>Diagnostics</h3>
                \${diagnosticsHtml || '<p>No issues detected.</p>'}
                
                <div class="raw-output">
                    <details>
                        <summary>View Raw Output</summary>
                        <pre>\${escapeHtml(result.rawOutput)}</pre>
                    </details>
                </div>
            \`;
        }

        function escapeHtml(unsafe) {
            if (!unsafe) return "";
            return unsafe
                 .replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;")
                 .replace(/"/g, "&quot;")
                 .replace(/'/g, "&#039;")
                 .replace(/\\\\/g, "\\\\\\\\"); // specific fix for win paths in JS string
        }
    </script>
</body>
</html>`;
    }
}
