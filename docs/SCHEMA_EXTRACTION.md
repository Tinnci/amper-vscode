# Schema Extraction Strategy

## Overview

This document explains how the `amper-vscode` extension maintains up-to-date JSON Schema for `module.yaml` IntelliSense without manual maintenance.

## The Problem

Amper's `module.yaml` structure is defined in Kotlin source code:

```kotlin
// vendor/amper/sources/frontend-api/src/org/jetbrains/amper/frontend/schema/root.kt
class Module : Base() {
    @SchemaDoc("Defines what should be produced out of the module")
    val product by value<ModuleProduct>()
    
    val aliases by nullableValue<Map<String, List<Platform>>>()
    // ...
}
```

**手动维护 JSON Schema 的痛点:**
- 当 Amper 更新时，Schema 会过时
- 手动同步容易出错
- 无法利用 Amper 源码中的文档和元数据

## The Solution: Automatic Extraction

我们构建了一个 **Rust 工具** (`tools/schema-extractor`) 来自动从 Kotlin 源代码生成 JSON Schema。

### Architecture

```
vendor/amper/sources/*.kt  →  [Parser]  →  [Type System]  →  [Schema Generator]  →  schemas/module-schema.json
```

### Key Components

#### 1. **Parser** (`parser.rs`)
- **输入**: Amper 的 Kotlin 源文件
- **功能**: 
  - 使用正则表达式提取类定义、属性、枚举
  - 解析注解 (`@SchemaDoc`, `@ModifierAware`, `@PlatformSpecific`)
  - 处理泛型类型 (`List<T>`, `Map<K,V>`)
- **输出**: 内部类型表示

#### 2. **Type System** (`types.rs`)
- **数据结构**:
  - `ClassDef`: 代表 Kotlin 类
  - `Property`: 类属性（包含类型、注解、文档）
  - `EnumDef`: 枚举定义

#### 3. **Schema Generator** (`schema.rs`)
- **输入**: 解析后的类型
- **功能**:
  - 将 Kotlin 类 → JSON Schema `$ref` 定义
  - 将 Sealed 类 → `anyOf` 联合类型
  - 将枚举 → `enum` + `x-intellij-enum-metadata`
  - 保留文档为 `description`
- **输出**: 完整的 JSON Schema (Draft 2020-12)

## Mapping Strategy

### Kotlin → JSON Schema

| Kotlin Structure | JSON Schema Equivalent |
|-----------------|----------------------|
| `class Module : SchemaNode()` | `{ "type": "object", "$ref": "#/$defs/Module" }` |
| `sealed class Dependency` | `{ "anyOf": [{ "$ref": "#/$defs/ExternalMavenDependency" }, ...] }` |
| `enum class ProductType` | `{ "enum": ["lib", "jvm/app", ...] }` |
| `val prop by value<String>()` | `{ "properties": { "prop": { "type": "string" } } }` |
| `val deps by nullableValue<List<T>>()` | `{ "properties": { "deps": { "type": "array", "items": {...} } } }` |
| `@SchemaDoc("...")` | `{ "description": "...", "title": "..." }` |
| `@ModifierAware` | `{ "patternProperties": { "^test-prop(@.+)?$": {...} } }` |

### Special Handling

#### 1. **Modifier-Aware Properties**

Kotlin:
```kotlin
@ModifierAware
val dependencies by nullableValue<List<Dependency>>()
```

JSON Schema:
```json
{
  "properties": {
    "dependencies": { ... }
  },
  "patternProperties": {
    "^test-dependencies(@.+)?$": { ... },
    "^dependencies(@.+)?$": { ... }
  }
}
```

#### 2. **Platform-Specific Properties**

Kotlin:
```kotlin
@PlatformSpecific(Platform.ANDROID)
val android: AndroidSettings by nested()
```

JSON Schema:
```json
{
  "properties": {
    "android": {
      "x-intellij-metadata": {
        "platforms": ["ANDROID"]
      }
    }
  }
}
```

#### 3. **Sealed Classes (Variants)**

Kotlin:
```kotlin
sealed class Dependency : SchemaNode()
class ExternalMavenDependency : Dependency() { ... }
class InternalDependency : Dependency() { ... }
```

JSON Schema:
```json
{
  "$defs": {
    "Dependency": {
      "anyOf": [
        { "$ref": "#/$defs/ExternalMavenDependency" },
        { "$ref": "#/$defs/InternalDependency" }
      ]
    }
  }
}
```

## Workflow Integration

### Development Workflow

1. **Amper 更新时**:
   ```bash
   git submodule update --remote vendor/amper
   ```

2. **重新生成 Schema**:
   ```bash
   cd tools/schema-extractor
   cargo run --release -- -s ../../vendor/amper/sources -o ../../schemas/module-schema.json -v
   ```

3. **验证并提交**:
   ```bash
   git add schemas/module-schema.json
   git commit -m "chore: update schema for Amper vX.Y.Z"
   ```

### Automated Build Integration

In `package.json`:

```json
{
  "scripts": {
    "extract-schema": "cd tools/schema-extractor && cargo run --release -- -s ../../vendor/amper/sources -o ../../schemas/module-schema.json",
    "prebuild": "npm run extract-schema",
    "build": "webpack"
  }
}
```

## Benefits

✅ **自动同步**: Schema 始终与 Amper 源码一致  
✅ **零维护**: 无需手动更新 JSON Schema  
✅ **文档完整**: 自动提取 `@SchemaDoc` 注解  
✅ **类型安全**: 直接从 Kotlin 类型生成  
✅ **扩展性**: 易于支持新的 Amper 特性

## Future Enhancements

- [ ] 支持 `project.yaml` 和 `template.yaml` 的 Schema 生成
- [ ] 从 Amper CLI 获取动态信息（如可用的模板列表）
- [ ] 生成 TypeScript 类型定义用于插件内部
- [ ] 增加测试用例验证 Schema 正确性

## References

- Amper 源代码: `vendor/amper/sources/frontend-api/src/org/jetbrains/amper/frontend/schema/`
- JSON Schema Spec: https://json-schema.org/draft/2020-12/schema
- VS Code YAML Support: https://github.com/redhat-developer/vscode-yaml

---

*Last Updated: December 28, 2025*
