import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { Logger } from '../../infrastructure/services/Logger';

export class ModuleConfigEditorProvider implements vscode.CustomTextEditorProvider {

    public static readonly viewType = 'amper-vscode.moduleConfigEditor';

    constructor(
        private readonly context: vscode.ExtensionContext
    ) { }

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new ModuleConfigEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(ModuleConfigEditorProvider.viewType, provider);
        return providerRegistration;
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        function updateWebview() {
            try {
                const text = document.getText();
                const data = yaml.parse(text) || {};
                webviewPanel.webview.postMessage({
                    type: 'update',
                    text: text,
                    data: data
                });
            } catch (e) {
                Logger.error('Failed to parse YAML for editor', e);
            }
        }

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.type) {
                case 'updateData':
                    this.updateYamlDocument(document, e.data);
                    return;
            }
        });

        updateWebview();
    }

    private updateYamlDocument(document: vscode.TextDocument, data: any) {
        const yamlStr = yaml.stringify(data);
        const edit = new vscode.WorkspaceEdit();

        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            yamlStr
        );

        return vscode.workspace.applyEdit(edit);
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = getNonce();

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Amper Module Editor</title>
                <style>
                    :root {
                        --padding: 24px;
                    }

                    body {
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-foreground);
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        padding: 0;
                        margin: 0;
                        overflow-x: hidden;
                    }

                    .editor-container {
                        max-width: 800px;
                        margin: 0 auto;
                        padding: var(--padding);
                    }

                    section {
                        margin-bottom: 32px;
                    }

                    h1 {
                        font-size: 20px;
                        font-weight: normal;
                        margin-bottom: 16px;
                        color: var(--vscode-settings-headerForeground);
                    }

                    .control-group {
                        margin-bottom: 20px;
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }

                    label {
                        font-weight: bold;
                        color: var(--vscode-foreground);
                        display: block;
                    }

                    .description {
                        font-size: 12px;
                        opacity: 0.8;
                        margin-bottom: 4px;
                        color: var(--vscode-descriptionForeground);
                    }

                    select, input[type="text"] {
                        background-color: var(--vscode-settings-dropdownBackground);
                        color: var(--vscode-settings-dropdownForeground);
                        border: 1px solid var(--vscode-settings-dropdownBorder);
                        padding: 6px 10px;
                        border-radius: 2px;
                        width: 100%;
                        box-sizing: border-box;
                    }

                    select:focus, input:focus {
                        border-color: var(--vscode-focusBorder);
                        outline: none;
                    }

                    .platform-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                        gap: 12px;
                    }

                    .platform-item {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 8px;
                        background: var(--vscode-list-hoverBackground);
                        border: 1px solid var(--vscode-widget-border);
                        border-radius: 4px;
                        cursor: pointer;
                        user-select: none;
                        opacity: 0.6;
                    }

                    .platform-item.selected {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border-color: var(--vscode-button-background);
                        opacity: 1;
                    }

                    .dependency-list {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }

                    .dependency-item {
                        display: flex;
                        gap: 8px;
                    }

                    button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 6px 12px;
                        cursor: pointer;
                        border-radius: 2px;
                        white-space: nowrap;
                    }

                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }

                    button.secondary {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }

                    button.secondary:hover {
                        background-color: var(--vscode-button-secondaryHoverBackground);
                    }

                    .divider {
                        height: 1px;
                        background-color: var(--vscode-settings-headerBorder);
                        margin: 24px 0;
                    }

                </style>
            </head>
            <body>
                <div class="editor-container">
                    <section>
                        <h1>Module Configuration</h1>
                        <div class="control-group">
                            <label for="product-type">Product Type</label>
                            <div class="description">Select the build target for this module.</div>
                            <select id="product-type">
                                <option value="lib">Library</option>
                                <option value="jvm/app">JVM Application</option>
                                <option value="android/app">Android Application</option>
                                <option value="ios/app">iOS Application</option>
                                <option value="compose/app">Compose Multiplatform App</option>
                            </select>
                        </div>
                    </section>

                    <div class="divider"></div>

                    <section>
                        <h1>Target Platforms</h1>
                        <div class="description" style="margin-bottom: 12px;">Choose which platforms this module supports.</div>
                        <div class="platform-grid" id="platforms-container"></div>
                    </section>

                    <div class="divider"></div>

                    <section>
                        <h1>Dependencies</h1>
                        <div class="description" style="margin-bottom: 12px;">External libraries and other modules.</div>
                        <div class="dependency-list" id="dependencies-list"></div>
                        <div class="dependency-item" style="margin-top: 12px;">
                            <input type="text" id="new-dep-input" placeholder="Artifact ID or module path">
                            <button id="add-dep-btn">Add</button>
                        </div>
                    </section>
                </div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    
                    const state = {
                        data: {
                            product: { type: 'lib', platforms: [] },
                            dependencies: []
                        }
                    };

                    const platforms = [
                        'jvm', 'android', 'iosArm64', 'iosSimulatorArm64', 'iosX64',
                        'macosArm64', 'macosX64', 'linuxX64', 'linuxArm64', 'mingwX64',
                        'js', 'wasmJs', 'wasmWasi'
                    ];

                    const productTypeSelect = document.getElementById('product-type');
                    const platformsContainer = document.getElementById('platforms-container');
                    const dependenciesList = document.getElementById('dependencies-list');
                    const newDepInput = document.getElementById('new-dep-input');
                    const addDepBtn = document.getElementById('add-dep-btn');

                    platforms.forEach(p => {
                        const el = document.createElement('div');
                        el.className = 'platform-item';
                        el.textContent = p;
                        el.onclick = () => togglePlatform(p);
                        el.dataset.platform = p;
                        platformsContainer.appendChild(el);
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'update':
                                updateFromYaml(message.data);
                                break;
                        }
                    });

                    function updateFromYaml(data) {
                        state.data = data || {};
                        let productType = 'lib';
                        let currentPlatforms = [];
                        
                        if (typeof state.data.product === 'string') {
                             productType = state.data.product;
                        } else if (state.data.product) {
                            productType = state.data.product.type || 'lib';
                            currentPlatforms = state.data.product.platforms || [];
                        }

                        productTypeSelect.value = productType;
                        
                        document.querySelectorAll('.platform-item').forEach(el => {
                            if (currentPlatforms.includes(el.dataset.platform)) {
                                el.classList.add('selected');
                            } else {
                                el.classList.remove('selected');
                            }
                        });

                        renderDependencies();
                    }

                    function renderDependencies() {
                        dependenciesList.innerHTML = '';
                        const deps = state.data.dependencies || [];
                        
                        deps.forEach((dep, index) => {
                            const row = document.createElement('div');
                            row.className = 'dependency-item';
                            
                            const input = document.createElement('input');
                            input.type = 'text';
                            input.value = typeof dep === 'string' ? dep : JSON.stringify(dep);
                            input.addEventListener('change', (e) => {
                                deps[index] = e.target.value;
                                updateState();
                            });
                            
                            const delBtn = document.createElement('button');
                            delBtn.className = 'secondary';
                            delBtn.textContent = 'Remove';
                            delBtn.onclick = () => {
                                deps.splice(index, 1);
                                renderDependencies();
                                updateState();
                            };
                            
                            row.appendChild(input);
                            row.appendChild(delBtn);
                            dependenciesList.appendChild(row);
                        });
                    }

                    function updateState() {
                        vscode.postMessage({
                            type: 'updateData',
                            data: state.data
                        });
                    }

                    productTypeSelect.addEventListener('change', (e) => {
                        if (typeof state.data.product === 'string') {
                            state.data.product = { type: e.target.value, platforms: [] };
                        } else {
                            if (!state.data.product) state.data.product = {};
                            state.data.product.type = e.target.value;
                        }
                        updateState();
                    });

                    function togglePlatform(p) {
                        if (typeof state.data.product === 'string') {
                            state.data.product = { type: state.data.product, platforms: [p] };
                        } else {
                            if (!state.data.product) state.data.product = { type: 'lib', platforms: []};
                            if (!state.data.product.platforms) state.data.product.platforms = [];
                            
                            const idx = state.data.product.platforms.indexOf(p);
                            if (idx === -1) {
                                state.data.product.platforms.push(p);
                            } else {
                                state.data.product.platforms.splice(idx, 1);
                            }
                        }
                        
                        const el = document.querySelector('.platform-item[data-platform="' + p + '"]');
                        if (el) el.classList.toggle('selected');
                        
                        updateState();
                    }

                    addDepBtn.addEventListener('click', () => {
                        const val = newDepInput.value.trim();
                        if (!val) return;
                        if (!state.data.dependencies) state.data.dependencies = [];
                        state.data.dependencies.push(val);
                        newDepInput.value = '';
                        renderDependencies();
                        updateState();
                    });
                </script>
            </body>
            </html>
        `;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
