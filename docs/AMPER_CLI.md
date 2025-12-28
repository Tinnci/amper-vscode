# Amper CLI Reference

This document provides an overview of the Amper CLI commands that are integrated into this VS Code extension. Amper is a tool for project configuration and build orchestration.

## Core Commands

### `amper init <template>`
Initializes a new Amper project in the current directory using a specified template.
- **Extension Integration**: Accessible via the "Amper: Initialize Project" command or the rocket icon in the Status Bar.

### `amper build`
Builds the project or a specific module.
- **Extension Integration**: Available as an inline action on modules in the Amper Project Explorer.

### `amper run`
Runs the application.
- **Extension Integration**: Available as an inline action on modules in the Amper Project Explorer.

### `amper test`
Runs unit tests for the project or a specific module.
- **Extension Integration**: Available as an inline action on modules in the Amper Project Explorer.

### `amper clean`
Cleans the build artifacts for the project or a specific module.
- **Extension Integration**: Available as an inline action on modules in the Amper Project Explorer.

## Introspection & Maintenance

### `amper show tasks`
Lists all available tasks for the current project/module.
- **Extension Integration**: Accessible via the "Show Tasks" context menu item on modules.

### `amper update`
Updates the Amper wrapper and CLI to the latest version.
- **Extension Integration**: Accessible via the "Amper: Update Amper" command in the Command Palette.

### `amper clean-shared-caches`
Cleans the global Amper caches shared across projects.
- **Extension Integration**: Accessible via the "Amper: Clean Shared Caches" command in the Command Palette.

### `amper --version`
Displays the current version of Amper.
- **Extension Integration**: Accessible via the "Amper: Check Version" command.
## Advanced Tools (`amper tool`)

Amper includes a set of specialized tools for environment management and diagnostics.

### `amper tool jdk`
Manages JDKs automatically provisioned by Amper.
- **Capabilities**: List installed JDKs, show paths, and manage versions.
- **Extension Integration**: A dedicated "Toolchains" view (JDK Manager) is available in the Activity Bar.

### `amper tool keystore`
Generates Keystores for Android application signing.
- **Capabilities**: Interactive creation of `.keystore` files.
- **Roadmap**: Planned "Android Signing Wizard" in VS Code.

### `amper tool jaeger`
Starts a Jaeger instance to visualize build performance traces.
- **Capabilities**: OpenTelemetry-based build profiling.
- **Roadmap**: Planned "Build Performance" dashboard.

## Project Migration

### `amper convert-project`
A powerful utility to migrate existing Maven projects to Amper.
- **Capabilities**: Parses `pom.xml` and generates equivalent `module.yaml` files.
- **Extension Integration**: Commands for project conversion and CodeLens support for `pom.xml` files.
## Project Structure

Amper projects are defined by a `module.yaml` file in each module directory. This file contains:
- **Product Type**: (e.g., `jvm/app`, `lib`, `android/app`)
- **Dependencies**: External libraries and internal module references.
- **Settings**: Compiler options and platform-specific configurations.

---

## How Amper Works (The Bootstrapper Architecture)

A common misconception is that Amper is a standalone binary (like `amper.exe`). In reality, Amper is a **JVM-based application** (written in Kotlin) that relies on a **Bootstrapper script** (`amper.bat` on Windows, `./amper` on Unix).

### The Role of the Wrapper Script

When you run `.\amper.bat show tasks`, the script performs the following orchestration:

1.  **Provisioning**: It checks if the required version of Amper and a compatible JRE (Java Runtime Environment) are present in the local cache (usually `%LOCALAPPDATA%\JetBrains\Amper`). If not, it downloads them automatically.
2.  **Environment Setup**: It sets up `AMPER_JAVA_HOME` and identifies the correct `java.exe` to use.
3.  **Classpath Construction**: It gathers all necessary JAR files from the downloaded Amper distribution.
4.  **Execution**: It launches the Java process with the following structure:
    ```batch
    "java.exe" -cp "amper-libs/*" org.jetbrains.amper.cli.MainKt <args>
    ```

### Implications for Extension Development

-   **No Standalone Binary**: Never look for an `amper.exe`. It doesn't exist.
-   **Always Use the Wrapper**: The extension must always invoke the `./amper` or `amper.bat` script found in the project root.
-   **Trust the Script**: The wrapper handles complex versioning, hash verification, and environment configuration. By calling the script, the extension ensures it's using the exact environment intended for that specific project.

---
*For more detailed information, visit the [official Amper documentation](https://github.com/JetBrains/amper).*
