#!/usr/bin/env pwsh
# Build script for the Amper Schema Extractor

$ErrorActionPreference = "Stop"

Write-Host "Building Amper Schema Extractor..." -ForegroundColor Cyan

# Navigate to the tool directory
Push-Location $PSScriptRoot

try {
    # Check if Rust is installed
    if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: Rust is not installed. Please install from https://rustup.rs" -ForegroundColor Red
        exit 1
    }

    Write-Host "Rust version:" -ForegroundColor Gray
    cargo --version

    # Build in release mode
    Write-Host "`nBuilding in release mode..." -ForegroundColor Yellow
    cargo build --release

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }

    # Extract schema
    $sourcePath = "../../vendor/amper/sources"
    $outputPath = "../../schemas/module-schema.json"

    if (-not (Test-Path $sourcePath)) {
        Write-Host "WARNING: Source path not found: $sourcePath" -ForegroundColor Yellow
        Write-Host "Skipping schema extraction." -ForegroundColor Yellow
    } else {
        Write-Host "`nExtracting schema..." -ForegroundColor Yellow
        
        $binaryName = if ($IsWindows) { "extract-schema.exe" } else { "extract-schema" }
        $binaryPath = Join-Path "target" "release" $binaryName

        if (-not (Test-Path $binaryPath)) {
            Write-Host "ERROR: Binary not found at $binaryPath" -ForegroundColor Red
            exit 1
        }

        & $binaryPath --source $sourcePath --output $outputPath --verbose

        if ($LASTEXITCODE -eq 0) {
            Write-Host "`nSuccess! Schema written to: $outputPath" -ForegroundColor Green
        } else {
            Write-Host "Schema extraction failed!" -ForegroundColor Red
            exit 1
        }
    }

    Write-Host "`nBuild complete!" -ForegroundColor Green
    Write-Host "Binary location: .\target\release\extract-schema.exe" -ForegroundColor Gray

} finally {
    Pop-Location
}
