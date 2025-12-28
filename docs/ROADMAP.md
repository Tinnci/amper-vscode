# Amper for VS Code - Roadmap

This document outlines the development plan for the Amper VS Code extension.

## 🚩 Phase 1: Core Infrastructure (Completed)
- [x] **DDD Architecture**: Established `domain`, `application`, `infrastructure`, and `presentation` layers.
- [x] **Process Executor**: Cross-platform wrapper for `./amper` and `amper.bat`.
- [x] **Version Check**: Basic command to verify Amper installation.

## 🚩 Phase 2: Task Integration (Completed)
- [x] **Project Discovery**: Automatic detection of Amper projects and `module.yaml` files.
- [x] **YAML Parsing**: Extraction of module types and metadata.
- [x] **Task Provider**: Integration with VS Code Task system (Build, Run, Test).

## 🚩 Phase 3: IDE Experience (Completed)
- [x] **Project Explorer**: Custom TreeView in the Activity Bar to visualize project structure.
- [x] **Module Commands**: Inline actions in the TreeView (Run, Test, Build).
- [x] **Output Highlighting**: Problem matchers for Kotlin compiler errors.
- [x] **Schema Support**: JSON Schema for `module.yaml` to provide IntelliSense.
- [x] **Advanced Task Support**: Support for `amper show tasks` and module-specific task execution.
- [x] **Smart Schema Generation**: Rust-based tool (`tools/schema-extractor`) that automatically extracts JSON Schema from Amper's Kotlin source code. No more manual schema maintenance!

## 🚩 Phase 4: Advanced Tooling & Migration (The "Power User" Update)
- [x] **Project Initialization Wizard**: A user-friendly UI for `amper init` with template selection.
- [x] **Global Maintenance**: Commands for `update` and `clean-shared-caches`.
- [x] **Maven Migration Assistant**: CodeLens and command integration for `amper convert-project`.
- [x] **JDK & Toolchain Management**: Visual manager for Amper-provisioned JDKs in the Activity Bar.
- [ ] **Android Keystore Wizard**: UI for generating signing keys (via `amper tool keystore`).
- [x] **Dynamic Template Discovery**: Templates extracted from Amper source code with rich UI display.

## 🎨 Phase 4.5: UI Polish (The "Quality of Life" Update)
- [x] **Enhanced Welcome View**: Rich welcome screen with quick actions when no project is open.
- [x] **Smart Status Bar**: Dynamic status bar showing project info and module count.
- [x] **Theme-Aware Branding**: Professional custom SVG logo integrated into Activity Bar and Extension icon.
- [x] **Product-Specific Icons**: Theme-integrated icons for different module types (Android, iOS, Server, etc.) using `ThemeColor`.
- [x] **Module Details Panel**: Integrated into the **Visual Config Editor**, providing a high-level overview of module settings.

## 🚩 Phase 5: Observability & Diagnostics (The "Performance" Update)
- [x] **Build Performance Profiler**: Integration with Jaeger UI (via `amper tool jaeger`) to visualize build traces.
- [x] **Dependency Tree View**: Interactive tree view for `amper show dependencies` with conflict highlighting.
- [x] **Interactive Diagnostic View**: Webview-based build reports with structured error parsing and "Explain Error" capabilities.
- [x] **Task Graph Visualization**: Interactive view of the task dependency graph using Mermaid.js.

## 🚩 Phase 6: Extensibility & Mobile (The "Ecosystem" Update)
- [x] **Mobile Device Manager**: Native ADB integration with Activity Bar tree view and Status Bar selector.
- [ ] **Plugin Discovery**: Integrated gallery to browse and add Amper plugins.
- [x] **Module Details Panel**: Interactive Webview panel (Visual Config Editor) showing detailed configurations, used platforms, and artifacts.
- [ ] **Live Device Logs**: Integrated log viewer for connected mobile devices.

## 🚩 Phase 7: Productivity & Intelligence (The "Smart" Update)
- [x] **Visual Config Editor**: A GUI-based editor for `module.yaml` with real-time validation, tooltips, and support for Android/Kotlin settings.
- [ ] **AI Build Assistant**: "Explain this Error" feature powered by LLMs, integrating build logs and source code.
- [ ] **Migration Wizard**: Step-by-step UI to transition projects from Gradle/Maven to Amper.
- [ ] **Refactoring Engine**: Automatic dependency updates when renaming or moving modules.

## 🚩 Phase 8: Ecosystem & Scale (The "Community" Update)
- [ ] **Amper Hub**: Community-driven template and plugin repository integration.
- [ ] **CLI Version Manager**: Easy switching and auto-updating of the local Amper CLI wrapper.
- [ ] **Remote Build Support**: Integration with various CI/CD providers for remote task execution.

## 🚀 Future Optimizations & Polish
- [ ] **Drag-and-Drop Operations**: Move files between modules to automatically update `module.yaml`.
- [ ] **Performance Dashboard**: Real-time stats on build times and success rates across project history.
- [x] **Dependency Search & Filter**: Search within the dependency tree to find specific artifacts and filter by conflicts.
- [ ] **Version Update Insights**: Highlight dependencies that have newer versions available.
- [ ] **Conflict Resolution UI**: Interactive actions to exclude or force versions in `module.yaml`.
- [ ] **Performance Overlay**: Real-time build status and performance metrics in a status bar overlay.
- [ ] **Multi-root Optimization**: Better handling of complex multi-root workspaces with cross-project dependencies.

---
*Last Updated: December 28, 2025*
