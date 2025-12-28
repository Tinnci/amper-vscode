import * as vscode from 'vscode';
import { TaskGraph } from '../../domain/models/TaskGraph';

export class TaskGraphPanel {
    public static currentPanel: TaskGraphPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'runTask':
                        vscode.commands.executeCommand('amper-vscode.runModule', {
                            module: { name: message.module },
                            rootPath: message.rootPath
                        });
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (TaskGraphPanel.currentPanel) {
            TaskGraphPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'amperTaskGraph',
            'Amper Task Graph',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')]
            }
        );

        TaskGraphPanel.currentPanel = new TaskGraphPanel(panel, extensionUri);
    }

    public static update(graph: TaskGraph) {
        if (TaskGraphPanel.currentPanel) {
            TaskGraphPanel.currentPanel._update(graph);
        }
    }

    public dispose() {
        TaskGraphPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update(graph: TaskGraph) {
        this._panel.webview.html = this._getHtmlForWebview(graph);
    }

    private _getHtmlForWebview(graph: TaskGraph): string {
        // Generate Mermaid definition
        // We use 'LR' (Left-to-Right) for timeline effect, or 'TD' (Top-Down)

        const nodesDef = graph.nodes.map(n => {
            // Escape special chars in ID
            const safeId = this.safeId(n.id);
            const label = n.name;
            return `${safeId}["${label}"]`;
        }).join('\n');

        const edgesDef = graph.edges.map(e => {
            const safeFrom = this.safeId(e.from);
            const safeTo = this.safeId(e.to);
            return `${safeFrom} --> ${safeTo}`;
        }).join('\n');

        const clickDef = graph.nodes.map(n => {
            const safeId = this.safeId(n.id);
            // Click callback
            return `click ${safeId} callTask("${n.id}")`;
        }).join('\n');

        const mermaidGraph = `
        graph LR
        ${nodesDef}
        ${edgesDef}
        ${clickDef}
        `;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Amper Task Graph</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
            overflow: auto;
        }
        #graph {
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <h2>Task Dependency Graph</h2>
    <div id="graph" class="mermaid">
        ${mermaidGraph}
    </div>

    <!-- Load Mermaid from CDN -->
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
        
        mermaid.initialize({ 
            startOnLoad: true, 
            theme: 'base',
            themeVariables: {
                primaryColor: '#3b82f6',
                primaryTextColor: '#fff',
                primaryBorderColor: '#3b82f6',
                lineColor: '#888',
                secondaryColor: '#8b5cf6',
                tertiaryColor: '#fff'
            }
        });

        const vscode = acquireVsCodeApi();
        
        window.callTask = (taskId) => {
            // Parse module from taskId if possible or pass whole ID
            vscode.postMessage({
                command: 'runTask',
                module: taskId, // Simplified, extension needs to handle parsing
                rootPath: '${graph.rootPath.replace(/\\/g, '\\\\')}'
            });
        };
    </script>
</body>
</html>`;
    }

    private safeId(id: string): string {
        // Replace colons and other special chars to make valid Mermaid IDs
        return id.replace(/[^a-zA-Z0-9]/g, '_');
    }
}
