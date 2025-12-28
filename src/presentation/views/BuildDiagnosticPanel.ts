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
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
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
        // In a real extension, we would load this from an HTML file
        // For simplicity, we embed it here with a basic dark/light theme aware CSS
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
                    return \`
                        <div class="diagnostic-card \${d.severity}">
                            <div class="title">
                                \${icon} <strong>\${d.message}</strong>
                            </div>
                            \${d.file ? \`<div class="location">
                                📄 <span class="file-link">\${d.file}:\${d.line || 1}</span>
                            </div>\` : ''}
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
            return unsafe
                 .replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;")
                 .replace(/"/g, "&quot;")
                 .replace(/'/g, "&#039;");
        }
    </script>
</body>
</html>`;
    }
}
