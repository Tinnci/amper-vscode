# Publishing Guide 🚀

This guide explains how to set up the automated CI/CD pipeline to publish the Amper VS Code extension to both the **Visual Studio Marketplace** (Official) and the **Open VSX Registry** (Open Source/VSCodium).

## Prerequisites

You need to obtain "Personal Access Tokens" (PAT) from both registries.

### 1. Visual Studio Marketplace (Official)
1. Go to [Azure DevOps](https://dev.azure.com/).
2. Create an Organization (if you haven't).
3. Click on the User Settings icon (top right) -> **Personal Access Tokens**.
4. Create a specific token:
   - **Name**: `amper-vscode-release`
   - **Organization**: `All accessible organizations`
   - **Scopes**: Search for "Marketplace" and select **Acquire** and **Manage**.
5. Copy the token string.

### 2. Open VSX Registry (Open Source)
1. Go to [Open VSX](https://open-vsx.org/).
2. Login with GitHub.
3. Go to **Settings** -> **Access Tokens**.
4. Create a new token and copy it.

### 3. Namespace Reservation
Before your first publish, you must manually create the "publisher" namespace.
- **VS Marketplace**: Go to [manage.vscode.com](https://marketplace.visualstudio.com/manage) -> Create Publisher. Use the exact `publisher` ID from `package.json` (currently `Tinnci`).
- **Open VSX**: Go to Settings -> Namespaces -> Create.

---

## 🔐 GitHub Secrets Configuration

To let GitHub Actions publish on your behalf, you need to save these tokens as Secrets.

1. Go to your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions**.
2. Click **New repository secret**.
3. Add the following two secrets:
    *   `VSCE_PAT`: (Paste your Azure DevOps Token)
    *   `OVSX_PAT`: (Paste your Open VSX Token)

---

## 🚀 How to Release

The release process is fully automated via Git Tags.

1. **Update Version**:
   Manually update the `version` field in `package.json` (e.g., to `0.0.2`).
   ```bash
   npm version patch  # or minor, major
   ```

2. **Push Code and Tag**:
   ```bash
   git push
   git push --tags
   ```

3. **Enjoy!**
   - GitHub Actions will detect the tag (e.g., `v0.0.2`).
   - It will compile, test, and package the extension.
   - It will automatically upload the new version to both Marketplaces.
   - It will create a "Release" page on GitHub with the `.vsix` file attached.

## 🛠️ Manual CLI Publishing (Optional)

If you prefer to publish manually from your local machine:

```bash
# Install CLI tools globally
npm install -g vsce ovsx

# Login
vsce login <publisher id>
# (Enter PAT when prompted)

# Publish
vsce publish
ovsx publish
```
