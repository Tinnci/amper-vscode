#!/bin/bash
# Build script for the Amper Schema Extractor (Linux/macOS)

set -e

echo -e "\033[36mBuilding Amper Schema Extractor...\033[0m"

# Navigate to the tool directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo -e "\033[31mERROR: Rust is not installed. Please install from https://rustup.rs\033[0m"
    exit 1
fi

echo -e "\033[90mRust version:\033[0m"
cargo --version

# Build in release mode
echo -e "\n\033[33mBuilding in release mode...\033[0m"
cargo build --release

if [ $? -ne 0 ]; then
    echo -e "\033[31mBuild failed!\033[0m"
    exit 1
fi

# Extract schema
SOURCE_PATH="../../vendor/amper/sources"
OUTPUT_PATH="../../schemas/module-schema.json"

if [ ! -d "$SOURCE_PATH" ]; then
    echo -e "\033[33mWARNING: Source path not found: $SOURCE_PATH\033[0m"
    echo -e "\033[33mSkipping schema extraction.\033[0m"
else
    echo -e "\n\033[33mExtracting schema...\033[0m"
    
    BINARY_PATH="target/release/extract-schema"

    if [ ! -f "$BINARY_PATH" ]; then
        echo -e "\033[31mERROR: Binary not found at $BINARY_PATH\033[0m"
        exit 1
    fi

    "$BINARY_PATH" --source "$SOURCE_PATH" --output "$OUTPUT_PATH" --verbose

    if [ $? -eq 0 ]; then
        echo -e "\n\033[32mSuccess! Schema written to: $OUTPUT_PATH\033[0m"
    else
        echo -e "\033[31mSchema extraction failed!\033[0m"
        exit 1
    fi
fi

echo -e "\n\033[32mBuild complete!\033[0m"
echo -e "\033[90mBinary location: ./target/release/extract-schema\033[0m"
