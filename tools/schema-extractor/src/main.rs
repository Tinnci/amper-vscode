//! Amper Schema Extractor
//!
//! This tool parses Kotlin source files from the Amper project to extract
//! schema definitions and generate a JSON Schema file for VS Code IntelliSense.

mod parser;
mod schema;
mod types;

use anyhow::{Context, Result};
use clap::Parser;
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(
    name = "extract-schema",
    about = "Extracts JSON Schema from Amper Kotlin sources",
    version
)]
struct Args {
    /// Path to the Amper source directory (vendor/amper/sources)
    #[arg(short, long)]
    source: PathBuf,

    /// Output file path for the generated JSON Schema
    #[arg(short, long, default_value = "module-schema.json")]
    output: PathBuf,

    /// Enable verbose output
    #[arg(short, long)]
    verbose: bool,

    /// Generate schema for: module, template, project
    #[arg(long, default_value = "module")]
    schema_type: String,
}

fn main() -> Result<()> {
    let args = Args::parse();

    if args.verbose {
        eprintln!("Amper Schema Extractor v{}", env!("CARGO_PKG_VERSION"));
        eprintln!("Source directory: {}", args.source.display());
        eprintln!("Output file: {}", args.output.display());
    }

    // Validate source directory
    let frontend_api_path = args.source.join("frontend-api/src/org/jetbrains/amper/frontend/schema");
    if !frontend_api_path.exists() {
        anyhow::bail!(
            "Invalid source directory. Expected to find: {}",
            frontend_api_path.display()
        );
    }

    // Parse Kotlin source files
    let context = parser::parse_source_directory(&args.source, args.verbose)
        .context("Failed to parse Kotlin source files")?;

    if args.verbose {
        eprintln!("Parsed {} types, {} enums", context.classes.len(), context.enums.len());
    }

    // Generate JSON Schema
    let root_type = match args.schema_type.as_str() {
        "module" => "Module",
        "template" => "Template",
        "project" => "Project",
        other => {
            eprintln!("Warning: Unknown schema type '{}', defaulting to 'Module'", other);
            "Module"
        }
    };

    let json_schema = schema::generate_json_schema(&context, root_type)
        .context("Failed to generate JSON Schema")?;

    // Write output
    let output_json = serde_json::to_string_pretty(&json_schema)
        .context("Failed to serialize JSON Schema")?;
    
    std::fs::write(&args.output, &output_json)
        .context("Failed to write output file")?;

    if args.verbose {
        eprintln!("Successfully wrote schema to {}", args.output.display());
    }

    println!("Schema extracted successfully: {}", args.output.display());
    Ok(())
}
