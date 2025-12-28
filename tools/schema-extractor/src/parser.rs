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
    context.verbose = verbose;

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
            parse_kotlin_file(path, &mut context, verbose)?;
        }
    }

    // Resolve sealed class hierarchies
    resolve_sealed_hierarchies(&mut context);
    
    // Debug: Print inheritance info
    if verbose {
        eprintln!("\n=== Class Inheritance ===");
        for (name, class) in &context.classes {
            if let Some(parent) = &class.parent {
                eprintln!("  {} extends {} ({} props)", name, parent, class.properties.len());
            }
        }
    }

    Ok(context)
}

/// Parse a single Kotlin file
fn parse_kotlin_file(path: &Path, context: &mut ParsingContext, verbose: bool) -> Result<()> {
    let content = fs::read_to_string(path)
        .with_context(|| format!("Failed to read file: {}", path.display()))?;

    // Parse enums
    parse_enums(&content, context)?;

    // Parse classes
    parse_classes(&content, context, verbose)?;

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
fn parse_classes(content: &str, context: &mut ParsingContext, verbose: bool) -> Result<()> {
    // Match class headers - need to handle multiline and various whitespace
    let class_header_regex = Regex::new(
        r"(?m)((?:@\w+\([^\)]*\)\s*)*)?\s*(abstract\s+|sealed\s+)?class\s+(\w+)\s*(?:\(\))?\s*:\s*(\w+)\s*\(\)\s*\{"
    )?;

    let mut matches = Vec::new();
    for cap in class_header_regex.captures_iter(content) {
        let start = cap.get(0).unwrap().start();
        
        // Extract annotations from group 1
        let annotations_str = cap.get(1).map(|m| m.as_str()).unwrap_or("");
        let doc = if annotations_str.contains("@SchemaDoc") {
            Some(extract_doc_string(annotations_str))
        } else {
            None
        };
        
        let is_abstract = cap.get(2).map(|m| m.as_str().contains("abstract")).unwrap_or(false);
        let is_sealed = cap.get(2).map(|m| m.as_str().contains("sealed")).unwrap_or(false);
        let name = cap.get(3).map(|m| m.as_str().to_string()).unwrap_or_default();
        let parent = cap.get(4).map(|m| m.as_str().to_string()).unwrap_or_default();
        
        if name.is_empty() || parent.is_empty() {
            continue;
        }
        
        if verbose {
            eprintln!("    Found class: {} (parent: {}, abstract: {}, sealed: {})", 
                     name, parent, is_abstract, is_sealed);
        }
        
        matches.push((start, doc, is_sealed, name, parent));
    }

    // Extract class bodies by finding matching braces
    for (start, doc, is_sealed, name, parent) in matches {
        // Include Base class and known schema classes
        let valid_parents = [
            "SchemaNode", "Base", "Dependency", "ScopedDependency",
            "UnscopedDependency", "BomDependency", "UnscopedBomDependency",
            "Settings",
        ];

        if !valid_parents.contains(&parent.as_str()) && !parent.ends_with("Settings") {
            if verbose {
                eprintln!("    Skipping {} - invalid parent: {}", name, parent);
            }
            continue;
        }

        // Find the class body by counting braces
        let body = extract_class_body(&content[start..])?;
        let properties = parse_properties(&body, verbose)?;
        
        if verbose {
            eprintln!("    Parsed {} with {} properties", name, properties.len());
        }

        context.classes.insert(
            name.clone(),
            ClassDef {
                name,
                doc,
                properties,
                is_sealed,
                parent: if parent != "SchemaNode" { Some(parent)} else { None },
                subclasses: Vec::new(),
            },
        );
    }

    Ok(())
}

/// Extract class body by matching braces
fn extract_class_body(text: &str) -> Result<String> {
    let open_brace = text.find('{').ok_or_else(|| anyhow::anyhow!("No opening brace found"))?;
    let mut depth = 0;
    let mut end_pos = open_brace;

    for (i, ch) in text[open_brace..].char_indices() {
        match ch {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    end_pos = open_brace + i;
                    break;
                }
            }
            _ => {}
        }
    }

    if depth != 0 {
        return Err(anyhow::anyhow!("Unmatched braces"));
    }

    Ok(text[open_brace + 1..end_pos].to_string())
}

/// Parse property definitions from class body
fn parse_properties(body: &str, verbose: bool) -> Result<Vec<Property>> {
    let mut properties = Vec::new();

    // Improved regex to match various property patterns
    // Matches: val name by value<Type>() / val name: Type by nested() / val name by nullableValue<Type>()
    let prop_regex = Regex::new(
        r"(?s)((?:@\w+(?:\([^\)]*\))?\s*)*)val\s+(\w+)(?:\s*:\s*(\w+(?:<[^>]*(?:<[^>]*>)?[^>]*>)?))?\s+by\s+(\w+)\s*(?:<([^>]*(?:<[^>]*>)?[^>]*)>)?\s*\("
    )?;

    for cap in prop_regex.captures_iter(body) {
        let annotations_str = &cap[1];
        let prop_name = cap[2].to_string();
        
        // Type can come from explicit type annotation (: Type) or from generic parameter (<Type>)
        let explicit_type = cap.get(3).map(|m| m.as_str().trim());
        let generic_type = cap.get(5).map(|m| m.as_str().trim());
        let delegate_func = &cap[4]; // value, nullableValue, nested, dependentValue
        
        let type_str = generic_type.or(explicit_type).unwrap_or("String");
        
        if verbose {
            eprintln!("      Property: {} (type: {}, delegate: {})", prop_name, type_str, delegate_func);
        }

        // Parse annotations
        let annotations = parse_annotations(annotations_str);

        // Extract doc
        let doc = annotations
            .iter()
            .find(|a| a.starts_with("SchemaDoc("))
            .map(|a| extract_doc_string(a));

        // Parse type info
        let (type_name, is_nullable, is_list, is_map) = parse_type_info(type_str);
        
        // Override nullability based on delegate function
        let is_nullable = is_nullable || delegate_func == "nullableValue";

        properties.push(Property {
            name: prop_name,
            type_name,
            doc,
            is_nullable,
            is_list,
            is_map,
            default_value: None,
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

