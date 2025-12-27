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

## 🚩 Phase 4: Advanced Features (Planned)
- [ ] **Project Templates**: Integration with `amper init` wizard.
- [ ] **Dependency Visualization**: Graphical or tree-based view of module dependencies.
- [ ] **Multi-root Support**: Better handling of complex VS Code workspaces.
- [ ] **LSP Integration**: (Long term) Full language server support for Kotlin/Java within Amper context.

---
*Last Updated: December 28, 2025*
