//! Type definitions for schema extraction

use indexmap::IndexMap;
use std::collections::HashSet;

/// Parsing context that holds all discovered types
#[derive(Debug, Default)]
pub struct ParsingContext {
    pub classes: IndexMap<String, ClassDef>,
    pub enums: IndexMap<String, EnumDef>,
    pub verbose: bool,
}

/// A Kotlin class definition
#[derive(Debug, Clone)]
pub struct ClassDef {
    pub name: String,
    pub doc: Option<String>,
    pub properties: Vec<Property>,
    pub is_sealed: bool,
    pub parent: Option<String>,
    pub subclasses: Vec<String>, // For sealed classes
}

/// A property in a Kotlin class
#[derive(Debug, Clone)]
pub struct Property {
    pub name: String,
    pub type_name: String,
    pub doc: Option<String>,
    pub is_nullable: bool,
    pub is_list: bool,
    pub is_map: bool,
    pub default_value: Option<String>,
    pub annotations: HashSet<String>,
}

impl Property {
    /// Check if this property has a specific annotation
    pub fn has_annotation(&self, annotation: &str) -> bool {
        self.annotations.contains(annotation)
    }

    /// Check if this property should be hidden from completion
    pub fn is_hidden(&self) -> bool {
        self.has_annotation("HiddenFromCompletion")
    }

    /// Check if this property is a shorthand
    #[allow(dead_code)]
    pub fn is_shorthand(&self) -> bool {
        self.has_annotation("Shorthand")
    }

    /// Check if this property is modifier-aware
    pub fn is_modifier_aware(&self) -> bool {
        self.has_annotation("ModifierAware")
    }

    /// Get platform-specific platforms
    pub fn get_platform_specific(&self) -> Vec<String> {
        self.annotations
            .iter()
            .filter(|a| a.starts_with("PlatformSpecific("))
            .flat_map(|a| Self::extract_annotation_values(a))
            .collect()
    }

    /// Get product-type-specific types
    pub fn get_product_type_specific(&self) -> Vec<String> {
        self.annotations
            .iter()
            .filter(|a| a.starts_with("ProductTypeSpecific("))
            .flat_map(|a| Self::extract_annotation_values(a))
            .collect()
    }

    /// Extract values from annotation string like "Annotation(VAL1, VAL2)"
    fn extract_annotation_values(annotation: &str) -> Vec<String> {
        if let Some(start) = annotation.find('(') {
            if let Some(end) = annotation.rfind(')') {
                let content = &annotation[start + 1..end];
                return content
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
            }
        }
        vec![]
    }
}

/// A Kotlin enum definition
#[derive(Debug, Clone)]
pub struct EnumDef {
    #[allow(dead_code)]
    pub name: String,
    #[allow(dead_code)]
    pub doc: Option<String>,
    pub entries: Vec<EnumEntry>,
    pub is_order_sensitive: bool,
}

/// An enum entry
#[derive(Debug, Clone)]
pub struct EnumEntry {
    #[allow(dead_code)]
    pub name: String,
    pub schema_value: String,
    pub doc: Option<String>,
    pub is_outdated: bool,
}
