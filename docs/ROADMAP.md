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

## 🚩 Phase 3: IDE Experience (In Progress)
- [x] **Project Explorer**: Custom TreeView in the Activity Bar to visualize project structure.
- [x] **Module Commands**: Inline actions in the TreeView (Run, Test, Build).
- [x] **Output Highlighting**: Problem matchers for Kotlin compiler errors.
- [x] **Schema Support**: JSON Schema for `module.yaml` to provide IntelliSense.
- [ ] **Advanced Task Support**: Support for `amper task` and custom task arguments.

## 🚩 Phase 4: Advanced Tooling & Integration (Planned)
- [ ] **Task Graph Visualization**: Interactive view of the task dependency graph (based on `amper show tasks`).
- [ ] **Project Initialization Wizard**: A user-friendly UI for `amper init` with template selection.
- [ ] **Dependency Management**: A dedicated view or UI to manage project dependencies and sync with `module.yaml`.
- [ ] **Amper Tool Support**: Integration for running custom tools via `amper tool`.
- [ ] **Profiling Integration**: Support for `--profile` with visualization of Async Profiler snapshots.

## 🚩 Phase 5: Ecosystem & Intelligence (Future)
- [ ] **LSP for module.yaml**: Full Language Server Protocol implementation for advanced refactoring and cross-file navigation.
- [ ] **Multi-platform Target Switcher**: Quick-pick UI to switch active compilation targets (JVM/Android/iOS).
- [ ] **CI/CD Scaffolding**: Commands to generate GitHub Actions or JetBrains Space Automation scripts for Amper.
- [ ] **Amper Update Notifications**: Automatic checks for new Amper versions and one-click updates.

---
*Last Updated: December 28, 2025*
