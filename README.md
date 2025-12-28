# Amper for VS Code

An **unofficial** VS Code extension providing comprehensive support for [Amper](https://github.com/JetBrains/amper) projects.

## Features

### 🚀 Smart IntelliSense
- **Auto-completion** for `module.yaml` files
- **Type validation** based on Amper's schema
- **Hover documentation** extracted from Amper source code
- **Automatic schema updates** via Rust-based extractor tool

### 📁 Project Explorer
- Browse Amper modules in a dedicated Activity Bar view
- Inline actions: Run, Test, Build, Clean
- Show available tasks for each module
- Initialize new projects with templates

### 🛠️ JDK & Toolchain Management
- View Amper-provisioned JDK versions
- Display JDK installation paths
- Clean bootstrap caches when needed

### 🔄 Maven Migration
- Convert Maven projects to Amper with one command
- Context menu on `pom.xml` files

### ⚙️ Task Integration
- Seamless integration with VS Code Task system
- Build, run, and test directly from the editor
- Problem matchers for Kotlin compiler errors

## Automatic Schema Extraction

This extension includes a **Rust-based schema extractor** that generates JSON Schema directly from Amper's Kotlin source code. This ensures the schema is always up-to-date with Amper's latest version.

**To update the schema when Amper is updated:**
```powershell
cd tools/schema-extractor
./build.ps1
```

See [Schema Extraction Guide](docs/SCHEMA_QUICKSTART.md) for details.

## Requirements

- **Amper** installed in your project (via wrapper scripts)
- **JDK** (automatically provisioned by Amper)
- **Rust** (optional, only needed to rebuild the schema extractor)

## Extension Commands

- `Amper: Check Version` - Display the current Amper version
- `Amper: Initialize Project` - Create a new Amper project
- `Amper: Convert Maven Project` - Convert a Maven project to Amper
- `Amper: Update Amper` - Update the Amper wrapper
- `Amper: Clean Shared Caches` - Clean global Amper caches
- `Amper: Clean Bootstrap Cache` - Clean JRE/distribution caches
- `Amper: Show JDK Info` - Display JDK information

## Getting Started

1. Open an Amper project or initialize a new one
2. The extension will automatically detect `module.yaml` files
3. Use the Amper Explorer in the Activity Bar to browse modules
4. Right-click on modules to run, test, or build

## Development

### Building the Extension

```bash
npm install
npm run compile
```

### Updating the Schema

When the Amper submodule is updated:

```powershell
# Update submodule
git submodule update --remote vendor/amper

# Rebuild schema
cd tools/schema-extractor
./build.ps1

# Commit changes
git add schemas/module-schema.json
git commit -m "chore: update schema for Amper vX.Y.Z"
```

## Documentation

- [Roadmap](docs/ROADMAP.md) - Development roadmap
- [Amper CLI Reference](docs/AMPER_CLI.md) - Amper commands
- [Schema Extraction](docs/SCHEMA_EXTRACTION.md) - Technical details of schema generation
- [Quick Start Guide](docs/SCHEMA_QUICKSTART.md) - Using the schema extractor

## Known Issues

- This is an unofficial extension and may not support all Amper features
- Schema extraction requires Rust toolchain (only for developers)

## Contributing

Contributions are welcome! Please check the [Roadmap](docs/ROADMAP.md) for planned features.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

MIT License - See [LICENSE](LICENSE) for details.

---

**Note:** This is an unofficial community extension. For official Amper support, see the [Amper documentation](https://github.com/JetBrains/amper).

**Enjoy!** 🎉
