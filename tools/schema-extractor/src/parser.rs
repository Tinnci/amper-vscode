//! Kotlin source file parser

use crate::types::*;
use anyhow::{Context, Result};
use regex::Regex;
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

/// Parse the entire source directory
pub fn parse_source_directory(source_dir: &Path, verbose: bool) -> Result<ParsingContext> {
    let mut context = ParsingContext::default();

    // Primary schema location
    let schema_path = source_dir.join("frontend-api/src/org/jetbrains/amper/frontend/schema");

    if verbose {
        eprintln!("Scanning schema files in: {}", schema_path.display());
    }

    for entry in WalkDir::new(&schema_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("kt") {
            if verbose {
                eprintln!("  Parsing: {}", path.file_name().unwrap().to_string_lossy());
            }
            parse_kotlin_file(path, &mut context)?;
        }
    }

    // Resolve sealed class hierarchies
    resolve_sealed_hierarchies(&mut context);

    Ok(context)
}

/// Parse a single Kotlin file
fn parse_kotlin_file(path: &Path, context: &mut ParsingContext) -> Result<()> {
    let content = fs::read_to_string(path)
        .with_context(|| format!("Failed to read file: {}", path.display()))?;

    // Parse enums
    parse_enums(&content, context)?;

    // Parse classes
    parse_classes(&content, context)?;

    Ok(())
}

/// Parse enum definitions
fn parse_enums(content: &str, context: &mut ParsingContext) -> Result<()> {
    let enum_regex = Regex::new(
        r"(?s)(@SchemaDoc\([^\)]+\)\s*)?(@EnumOrderSensitive[^\n]*)?\s*enum\s+class\s+(\w+)\s*\([^)]*\)\s*:\s*SchemaEnum\s*\{([^}]+)\}"
    )?;

    for cap in enum_regex.captures_iter(content) {
        let doc = cap.get(1).map(|m| extract_doc_string(m.as_str()));
        let is_order_sensitive = cap.get(2).is_some();
        let name = cap[3].to_string();
        let body = &cap[4];

        let mut entries = Vec::new();
        let entry_regex = Regex::new(
            r#"(@SchemaDoc\([^\)]+\)\s*)?(\w+)\s*\(\s*"([^"]+)""#
        )?;

        for entry_cap in entry_regex.captures_iter(body) {
            let entry_doc = entry_cap.get(1).map(|m| extract_doc_string(m.as_str()));
            let entry_name = entry_cap[2].to_string();
            let schema_value = entry_cap[3].to_string();

            // Check if marked as outdated in the body
            let is_outdated = body.contains(&format!("outdated: Boolean = true"))
                && body[..entry_cap.get(0).unwrap().end()].contains(&entry_name);

            entries.push(EnumEntry {
                name: entry_name,
                schema_value,
                doc: entry_doc,
                is_outdated,
            });
        }

        context.enums.insert(
            name.clone(),
            EnumDef {
                name,
                doc,
                entries,
                is_order_sensitive,
            },
        );
    }

    Ok(())
}

/// Parse class definitions
fn parse_classes(content: &str, context: &mut ParsingContext) -> Result<()> {
    // Match both sealed and regular classes
    let class_regex = Regex::new(
        r"(?s)(@SchemaDoc\([^\)]+\)\s*)?(sealed\s+)?class\s+(\w+)\s*(?:\(\))?\s*:\s*(\w+)\s*\(\)\s*\{([^}]*)\}"
    )?;

    for cap in class_regex.captures_iter(content) {
        let doc = cap.get(1).map(|m| extract_doc_string(m.as_str()));
        let is_sealed = cap.get(2).is_some();
        let name = cap[3].to_string();
        let parent = cap[4].to_string();
        let body = &cap[5];

        // Skip if parent is not SchemaNode or known base class
        if !["SchemaNode", "Base", "Dependency", "ScopedDependency", "UnscopedDependency", "BomDependency", "UnscopedBomDependency"].contains(&parent.as_str()) {
            continue;
        }

        let properties = parse_properties(body)?;

        context.classes.insert(
            name.clone(),
            ClassDef {
                name,
                doc,
                properties,
                is_sealed,
                parent: if parent != "SchemaNode" { Some(parent) } else { None },
                subclasses: Vec::new(),
            },
        );
    }

    Ok(())
}

/// Parse property definitions from class body
fn parse_properties(body: &str) -> Result<Vec<Property>> {
    let mut properties = Vec::new();

    // Match property definitions with annotations
    let prop_regex = Regex::new(
        r"(?s)((?:@\w+(?:\([^\)]*\))?\s*)*)\s*val\s+(\w+)\s+by\s+(?:value|nullableValue|nested|dependentValue)\s*(?:<([^>]+)>)?\s*\((?:[^\)]*)\)"
    )?;

    for cap in prop_regex.captures_iter(body) {
        let annotations_str = &cap[1];
        let prop_name = cap[2].to_string();
        let type_str = cap.get(3).map(|m| m.as_str().trim()).unwrap_or("String");

        // Parse annotations
        let annotations = parse_annotations(annotations_str);

        // Extract doc
        let doc = annotations
            .iter()
            .find(|a| a.starts_with("SchemaDoc("))
            .map(|a| extract_doc_string(a));

        // Parse type info
        let (type_name, is_nullable, is_list, is_map) = parse_type_info(type_str);

        properties.push(Property {
            name: prop_name,
            type_name,
            doc,
            is_nullable,
            is_list,
            is_map,
            default_value: None, // Could be extracted if needed
            annotations,
        });
    }

    Ok(properties)
}

/// Parse annotations from annotation string
fn parse_annotations(annotations_str: &str) -> HashSet<String> {
    let annotation_regex = Regex::new(r"@(\w+)(?:\([^\)]*\))?").unwrap();
    annotation_regex
        .captures_iter(annotations_str)
        .map(|cap| cap[0].to_string())
        .collect()
}

/// Parse type information
fn parse_type_info(type_str: &str) -> (String, bool, bool, bool) {
    let type_str = type_str.trim();
    
    // Check for nullable
    let is_nullable = type_str.ends_with('?');
    let type_str = type_str.trim_end_matches('?');

    // Check for List
    if type_str.starts_with("List<") {
        let inner = type_str.strip_prefix("List<").unwrap().strip_suffix('>').unwrap();
        return (inner.to_string(), is_nullable, true, false);
    }

    // Check for Map
    if type_str.starts_with("Map<") {
        let inner = type_str.strip_prefix("Map<").unwrap().strip_suffix('>').unwrap();
        // For Map<String, Type>, we want Type
        if let Some(comma_pos) = inner.find(',') {
            let value_type = inner[comma_pos + 1..].trim();
            return (value_type.to_string(), is_nullable, false, true);
        }
    }

    (type_str.to_string(), is_nullable, false, false)
}

/// Extract documentation string from @SchemaDoc annotation
fn extract_doc_string(annotation: &str) -> String {
    let doc_regex = Regex::new(r#"@SchemaDoc\s*\(\s*"([^"]*)""#).unwrap();
    if let Some(cap) = doc_regex.captures(annotation) {
        cap[1].to_string()
    } else {
        String::new()
    }
}

/// Resolve sealed class hierarchies
fn resolve_sealed_hierarchies(context: &mut ParsingContext) {
    let sealed_classes: Vec<String> = context
        .classes
        .iter()
        .filter(|(_, class)| class.is_sealed)
        .map(|(name, _)| name.clone())
        .collect();

    for sealed_name in sealed_classes {
        let subclasses: Vec<String> = context
            .classes
            .iter()
            .filter(|(_, class)| {
                class.parent.as_ref().map(|p| p == &sealed_name).unwrap_or(false)
            })
            .map(|(name, _)| name.clone())
            .collect();

        if let Some(sealed_class) = context.classes.get_mut(&sealed_name) {
            sealed_class.subclasses = subclasses;
        }
    }
}
