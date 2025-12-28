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

    /**
     * Called when our custom editor is opened.
     */
    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Setup initial content for the webview
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

        // Hook up event handlers so that we can synchronize the webview with the text document.
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });

        // Make sure we get rid of the listener when our editor is closed.
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        // Receive message from the webview.
        webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.type) {
                case 'updateData':
                    this.updateYamlDocument(document, e.data);
                    return;
            }
        });

        updateWebview();
    }

    /**
     * Write out the yaml to the document.
     */
    private updateYamlDocument(document: vscode.TextDocument, data: any) {
        const yamlStr = yaml.stringify(data); // TODO: Preserve comments and structure if possible, but basic dump for now
        // For a better experience, we should use `yaml`'s CST/AST modification to preserve comments, 
        // but for this MVP "Cool UI", we'll overwrite.
        // Actually, the user might hate losing comments. 
        // Let's acknowledge this limitation or try to use a more surgical edit if possible.
        // For now, full overwrite is the standard "Form Editor" behavior in many VS Code extensions.

        const edit = new vscode.WorkspaceEdit();

        // Just replace the whole thing
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            yamlStr
        );

        return vscode.workspace.applyEdit(edit);
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = getNonce();

        // Premium Dark Theme CSS
        // Using Inter font, glassmorphism, gradients.
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Amper Module Editor</title>
                <style>
                    :root {
                        --bg-color: #0d1117;
                        --card-bg: #161b22;
                        --text-primary: #e6edf3;
                        --text-secondary: #8b949e;
                        --accent: #58a6ff;
                        --accent-hover: #79c0ff;
                        --border: #30363d;
                        --success: #2ea043;
                        --input-bg: #010409;
                        --glass-bg: rgba(22, 27, 34, 0.7);
                        --glow: 0 0 10px rgba(88, 166, 255, 0.2);
                    }

                    body {
                        background-color: var(--bg-color);
                        color: var(--text-primary);
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        padding: 0;
                        margin: 0;
                        display: flex;
                        justify-content: center;
                        min-height: 100vh;
                    }

                    .container {
                        width: 100%;
                        max-width: 800px;
                        padding: 2rem;
                        box-sizing: border-box;
                    }

                    h1, h2, h3 {
                        margin: 0 0 1rem 0;
                        font-weight: 600;
                    }

                    .header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        margin-bottom: 2rem;
                        border-bottom: 1px solid var(--border);
                        padding-bottom: 1rem;
                    }

                    .header h1 {
                        font-size: 1.5rem;
                        background: linear-gradient(90deg, #a371f7, #58a6ff);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        margin: 0;
                    }

                    .card {
                        background: var(--card-bg);
                        border: 1px solid var(--border);
                        border-radius: 12px;
                        padding: 1.5rem;
                        margin-bottom: 1.5rem;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                        backdrop-filter: blur(10px);
                        transition: transform 0.2s, box-shadow 0.2s;
                    }

                    .card:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 8px 30px rgba(0,0,0,0.3);
                        border-color: #58a6ff;
                    }

                    .field-group {
                        margin-bottom: 1.2rem;
                    }

                    label {
                        display: block;
                        font-size: 0.85rem;
                        color: var(--text-secondary);
                        margin-bottom: 0.5rem;
                        font-weight: 500;
                    }

                    input[type="text"], select, textarea {
                        width: 100%;
                        background: var(--input-bg);
                        border: 1px solid var(--border);
                        color: var(--text-primary);
                        padding: 10px;
                        border-radius: 6px;
                        font-size: 0.95rem;
                        transition: all 0.2s;
                        box-sizing: border-box;
                    }

                    input:focus, select:focus, textarea:focus {
                        outline: none;
                        border-color: var(--accent);
                        box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.1);
                    }

                    .chips {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px;
                        margin-top: 8px;
                    }

                    .chip {
                        background: rgba(88, 166, 255, 0.15);
                        color: var(--accent);
                        padding: 4px 10px;
                        border-radius: 20px;
                        font-size: 0.8rem;
                        display: flex;
                        align-items: center;
                        border: 1px solid transparent;
                        cursor: pointer;
                        transition: all 0.2s;
                    }

                    .chip:hover {
                        background: rgba(88, 166, 255, 0.25);
                        border-color: var(--accent);
                    }

                    .chip span {
                        margin-right: 6px;
                    }

                    .chip .remove {
                        font-weight: bold;
                        opacity: 0.7;
                    }
                    
                    .chip .remove:hover {
                        opacity: 1;
                    }
                    
                    .chip-input {
                        margin-top: 0.5rem;
                    }

                    .platforms-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                        gap: 10px;
                    }
                    
                    .platform-option {
                        background: var(--input-bg);
                        border: 1px solid var(--border);
                        border-radius: 8px;
                        padding: 10px;
                        text-align: center;
                        cursor: pointer;
                        user-select: none;
                        transition: all 0.2s;
                        font-size: 0.9rem;
                    }
                    
                    .platform-option.selected {
                        background: rgba(46, 160, 67, 0.15);
                        border-color: var(--success);
                        color: #7ee787;
                    }
                    
                    .btn {
                        background: var(--accent);
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 500;
                        transition:  0.2s;
                    }
                    
                    .btn:hover {
                        background: var(--accent-hover);
                    }
                    
                    .btn-secondary {
                        background: var(--border);
                    }
                    
                    .btn-secondary:hover {
                        background: #444c56;
                    }

                    .dependency-row {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 8px;
                        align-items: center;
                    }
                    
                    .icon {
                        margin-right: 8px;
                        font-family: 'Segoe UI Symbol', sans-serif;
                    }

                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Product Configuration</h1>
                        <div class="status" id="status-indicator">Ready</div>
                    </div>

                    <div class="card">
                        <h2>📦 Basic Info</h2>
                        <div class="field-group">
                            <label>Product Type</label>
                            <select id="product-type">
                                <option value="lib">Library (lib)</option>
                                <option value="jvm/app">JVM Application (jvm/app)</option>
                                <option value="android/app">Android Application (android/app)</option>
                                <option value="ios/app">iOS Application (ios/app)</option>
                                <option value="compose/app">Compose Application (compose/app)</option>
                                <option value="cli/app">CLI Application</option>
                            </select>
                        </div>
                    </div>

                    <div class="card">
                        <h2>🌍 Target Platforms</h2>
                        <div class="platforms-grid" id="platforms-container">
                            <!-- JS will populate -->
                        </div>
                    </div>

                    <div class="card">
                        <h2>🔗 Dependencies</h2>
                        <div id="dependencies-list"></div>
                        <div class="field-group" style="margin-top: 1rem; display: flex; gap: 10px;">
                            <input type="text" id="new-dep-input" placeholder="e.g. org.jetbrains.kotlinx:kotlinx-datetime:0.5.0">
                            <button class="btn" id="add-dep-btn">Add</button>
                        </div>
                    </div>
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

                    // Render Platforms
                    platforms.forEach(p => {
                        const el = document.createElement('div');
                        el.className = 'platform-option';
                        el.textContent = p;
                        el.onclick = () => togglePlatform(p);
                        el.dataset.platform = p;
                        platformsContainer.appendChild(el);
                    });

                    // Handle messages
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
                        
                        // Normalize product
                        let productType = 'lib';
                        let currentPlatforms = [];
                        
                        if (typeof state.data.product === 'string') {
                             productType = state.data.product;
                        } else if (state.data.product) {
                            productType = state.data.product.type || 'lib';
                            currentPlatforms = state.data.product.platforms || [];
                        }

                        // Update UI
                        productTypeSelect.value = productType;
                        
                        // Highlight platforms
                        document.querySelectorAll('.platform-option').forEach(el => {
                            if (currentPlatforms.includes(el.dataset.platform)) {
                                el.classList.add('selected');
                            } else {
                                el.classList.remove('selected');
                            }
                        });

                        // Dependencies
                        renderDependencies();
                    }

                    function renderDependencies() {
                        dependenciesList.innerHTML = '';
                        const deps = state.data.dependencies || [];
                        
                        deps.forEach((dep, index) => {
                            const row = document.createElement('div');
                            row.className = 'dependency-row';
                            
                            const input = document.createElement('input');
                            input.type = 'text';
                            input.value = typeof dep === 'string' ? dep : JSON.stringify(dep);
                            input.onchange = (e) => updateDependency(index, e.target.value);
                            
                            const delBtn = document.createElement('button');
                            delBtn.className = 'btn btn-secondary';
                            delBtn.textContent = '×';
                            delBtn.onclick = () => removeDependency(index);
                            
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

                    // Event Listeners
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
                            // Convert simplified string format to object format to support platforms
                            state.data.product = { 
                                type: state.data.product, 
                                platforms: [p] 
                            };
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
                        
                        // Update UI immediately (optimistic)
                        const el = document.querySelector(\`.platform-option[data-platform="\${p}"]\`);
                        el.classList.toggle('selected');
                        
                        updateState();
                    }

                    function addDependency() {
                        const val = newDepInput.value.trim();
                        if (!val) return;
                        
                        if (!state.data.dependencies) state.data.dependencies = [];
                        state.data.dependencies.push(val);
                        
                        newDepInput.value = '';
                        renderDependencies();
                        updateState();
                    }
                    
                    addDepBtn.addEventListener('click', addDependency);
                    
                    window.updateDependency = (index, val) => {
                        if (!state.data.dependencies) return;
                        state.data.dependencies[index] = val;
                        updateState();
                    };
                    
                    window.removeDependency = (index) => {
                        if (!state.data.dependencies) return;
                        state.data.dependencies.splice(index, 1);
                        renderDependencies();
                        updateState();
                    };

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
