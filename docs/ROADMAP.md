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
- [ ] **Module Details Panel**: Webview panel showing detailed module configuration.

## 🚩 Phase 5: Observability & Diagnostics (The "Performance" Update)
- [ ] **Build Performance Profiler**: Integration with Jaeger UI (via `amper tool jaeger`) to visualize build traces.
- [x] **Dependency Tree View**: Interactive tree view for `amper show dependencies` with conflict highlighting.
- [x] **Interactive Diagnostic View**: Webview-based build reports with structured error parsing and "Explain Error" capabilities.
- [ ] **Task Graph Visualization**: Interactive view of the task dependency graph.

## 🚩 Phase 6: Extensibility & Mobile (The "Ecosystem" Update)
- [ ] **Mobile Device Manager**: ADB/Simulator selection UI for `amper run` on Android and iOS.
- [ ] **XCode Sync Integration**: One-click "Open in XCode" and project synchronization.
- [ ] **Plugin Development Support**: IntelliSense and scaffolding for Amper extensibility API.
- [ ] **CI/CD Scaffolding**: Generate GitHub Actions or Space Automation scripts.

## 🚀 Future Optimizations & Polish
- [ ] **Dependency Search & Filter**: Search within the dependency tree to find specific artifacts.
- [ ] **Version Update Insights**: Highlight dependencies that have newer versions available.
- [ ] **Conflict Resolution UI**: Interactive actions to exclude or force versions in `module.yaml`.
- [ ] **Performance Overlay**: Real-time build status and performance metrics in a status bar overlay.
- [ ] **Multi-root Optimization**: Better handling of complex multi-root workspaces with cross-project dependencies.

---
*Last Updated: December 28, 2025*
