# Amper Schema Extractor

A Rust-based tool to automatically extract JSON Schema from Amper's Kotlin source code for VS Code IntelliSense support.

## Why This Tool?

Amper's `module.yaml` structure is defined in Kotlin source files. Instead of manually writing and maintaining JSON Schema, this tool:

1. **Parses** Kotlin source files from `vendor/amper/sources/frontend-api/src/org/jetbrains/amper/frontend/schema`
2. **Extracts** class definitions, properties, enums, and documentation
3. **Generates** a complete JSON Schema compatible with VS Code's YAML language server

## Features

- ✅ Extracts class hierarchies and sealed classes
- ✅ Parses property types including generics (`List<T>`, `Map<K,V>`)
- ✅ Preserves `@SchemaDoc` documentation as JSON Schema descriptions
- ✅ Handles Amper-specific annotations:
  - `@ModifierAware` → generates `patternProperties` for `test-*` prefixes
  - `@PlatformSpecific` → adds `x-intellij-metadata`
  - `@ProductTypeSpecific` → adds product type metadata
  - `@HiddenFromCompletion` → excludes from schema
  - `@Shorthand` → marks shorthand properties
- ✅ Generates enum schemas with metadata (`x-intellij-enum-metadata`)
- ✅ Supports sealed classes as `anyOf` unions

## Building

### Prerequisites

- Rust 1.70+ (install from [rustup.rs](https://rustup.rs))

### Compile

```bash
cd tools/schema-extractor
cargo build --release
```

The compiled binary will be at: `target/release/extract-schema.exe` (Windows) or `target/release/extract-schema` (Unix)

## Usage

### Basic

```bash
extract-schema --source ../../vendor/amper/sources --output ../../schemas/module-schema.json
```

### Options

```
Options:
  -s, --source <PATH>        Path to vendor/amper/sources directory
  -o, --output <PATH>        Output JSON Schema file [default: module-schema.json]
      --schema-type <TYPE>   Schema root type: module, template, project [default: module]
  -v, --verbose              Enable verbose output
  -h, --help                 Print help
  -V, --version              Print version
```

### Example

```bash
# Extract Module schema (for module.yaml)
extract-schema -s ../../vendor/amper/sources -o ../../schemas/module-schema.json --schema-type module

# Extract Template schema (for template files)
extract-schema -s ../../vendor/amper/sources -o ../../schemas/template-schema.json --schema-type template

# Verbose mode
extract-schema -s ../../vendor/amper/sources -o ../../schemas/module-schema.json -v
```

## Integration with Extension Build

Add to `package.json` scripts:

```json
{
  "scripts": {
    "extract-schema": "cd tools/schema-extractor && cargo run --release -- --source ../../vendor/amper/sources --output ../../schemas/module-schema.json",
    "build": "npm run extract-schema && webpack"
  }
}
```

## How It Works

### 1. Parser (`parser.rs`)

- Walks through `vendor/amper/sources/frontend-api/src/org/jetbrains/amper/frontend/schema/*.kt`
- Uses regex to extract:
  - Class definitions: `class Module : SchemaNode() { ... }`
  - Properties: `val product by value<ModuleProduct>()`
  - Enums: `enum class ProductType(...) : SchemaEnum { ... }`
  - Annotations: `@SchemaDoc(...)`, `@ModifierAware`, etc.

### 2. Type System (`types.rs`)

- Represents parsed Kotlin structures in Rust:
  - `ClassDef`: Kotlin classes with properties
  - `Property`: Class properties with type info and annotations
  - `EnumDef`: Enum types with entries

### 3. Schema Generator (`schema.rs`)

- Converts parsed types to JSON Schema
- Handles:
  - Primitive types → JSON types
  - Classes → `$ref` definitions
  - Sealed classes → `anyOf`
  - Enums → `enum` with metadata
  - Collections → `array` with `items`
  - Maps → `array` of objects with `patternProperties`

## Example Output

For this Kotlin code:

```kotlin
@SchemaDoc("A JVM console or desktop application")
JVM_APP(
    "jvm/app",
    supportedPlatforms = setOf(Platform.JVM),
    defaultPlatforms = setOf(Platform.JVM)
)
```

Generates:

```json
{
  "enum": ["lib", "jvm/app", "android/app", ...],
  "x-intellij-enum-metadata": {
    "jvm/app": "A JVM console or desktop application"
  }
}
```

## Maintenance

When Amper updates:

1. Update the submodule: `git submodule update --remote vendor/amper`
2. Re-run the extractor: `npm run extract-schema`
3. Commit the updated schema

## License

MIT License - Same as the amper-vscode extension
