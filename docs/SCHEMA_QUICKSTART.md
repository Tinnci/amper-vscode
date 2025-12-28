# Quick Start: Schema Extractor

## 快速使用指南

### 方式一：使用构建脚本（推荐）

```powershell
cd tools/schema-extractor
./build.ps1
```

这会自动：
1. 编译 Rust 工具
2. 提取 Schema
3. 输出到 `schemas/module-schema.json`

### 方式二：手动运行

```powershell
# 编译（仅需一次）
cd tools/schema-extractor
cargo build --release

# 提取 Schema
./target/release/extract-schema.exe `
  --source ../../vendor/amper/sources `
  --output ../../schemas/module-schema.json `
  --verbose
```

### 方式三：集成到 NPM 脚本

在 `package.json` 中添加：

```json
{
  "scripts": {
    "extract-schema": "npm run extract-schema",
    "vscode:prepublish": "npm run extract-schema && npm run package"
  }
}
```

然后运行：
```bash
npm run extract-schema
```

## 验证生成的 Schema

生成后，打开任意 `module.yaml` 文件，你应该会看到：
- ✅ 自动补全建议
- ✅ 悬停提示显示文档
- ✅ 类型校验错误提示

## 更新 Schema （当 Amper 更新时）

```powershell
# 1. 更新 Amper 子模块
git submodule update --remote vendor/amper

# 2. 重新生成 Schema
cd tools/schema-extractor
./build.ps1

# 3. 验证并提交
git add ../../schemas/module-schema.json
git commit -m "chore: update schema for Amper vX.Y.Z"
```

## 故障排除

### 问题：Rust 未安装

**解决方案：**
```powershell
# 下载并安装 Rust
winget install Rustlang.Rustup
# 或访问 https://rustup.rs
```

### 问题：编译失败

**解决方案：**
```powershell
# 清理并重新构建
cd tools/schema-extractor
cargo clean
cargo build --release
```

### 问题：Schema 不完整

**可能原因：**
1. Amper 源码路径不正确
2. Kotlin 文件格式变化

**解决方案：**
- 使用 `--verbose` 查看详细日志
- 检查 `vendor/amper/sources/frontend-api/src/org/jetbrains/amper/frontend/schema` 是否存在

## 下一步

查看完整文档：
- [SCHEMA_EXTRACTION.md](./SCHEMA_EXTRACTION.md) - 详细架构说明
- [tools/schema-extractor/README.md](../tools/schema-extractor/README.md) - 工具文档
