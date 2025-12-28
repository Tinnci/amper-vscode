//! JSON Schema generation

use crate::types::*;
use anyhow::Result;
use indexmap::IndexMap;
use serde_json::{json, Map, Value};

/// Generate JSON Schema from parsing context
pub fn generate_json_schema(context: &ParsingContext, root_type: &str) -> Result<Value> {
    let mut builder = SchemaBuilder::new(context);
    builder.build(root_type)
}

struct SchemaBuilder<'a> {
    context: &'a ParsingContext,
    definitions: IndexMap<String, Value>,
}

impl<'a> SchemaBuilder<'a> {
    fn new(context: &'a ParsingContext) -> Self {
        Self {
            context,
            definitions: IndexMap::new(),
        }
    }

    fn build(&mut self, root_type: &str) -> Result<Value> {
        // Build all referenced types
        if let Some(root_class) = self.context.classes.get(root_type) {
            self.build_class_definition(root_class);
        } else {
            anyhow::bail!("Root type '{}' not found", root_type);
        }

        // Create root schema
        Ok(json!({
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "$id": format!("{}.json", root_type),
            "title": format!("{} schema", root_type),
            "type": "object",
            "allOf": [
                { "$ref": format!("#/$defs/{}", root_type) }
            ],
            "$defs": self.definitions
        }))
    }

    fn build_class_definition(&mut self, class: &ClassDef) {
        let name = &class.name;

        // Skip if already processed
        if self.definitions.contains_key(name) {
            return;
        }

        // Handle sealed classes (variants)
        if class.is_sealed && !class.subclasses.is_empty() {
            let variants: Vec<Value> = class
                .subclasses
                .iter()
                .filter_map(|subclass_name| {
                    self.context.classes.get(subclass_name).map(|subclass| {
                        self.build_class_definition(subclass);
                        json!({ "$ref": format!("#/$defs/{}", subclass_name) })
                    })
                })
                .collect();

            self.definitions.insert(
                name.clone(),
                json!({
                    "anyOf": variants
                }),
            );
            return;
        }

        // Collect properties from this class and its parent
        let mut all_properties = class.properties.clone();
        
        // If this class has a parent, merge parent's properties
        if let Some(parent_name) = &class.parent {
            if let Some(parent_class) = self.context.classes.get(parent_name) {
                // Add parent properties that don't conflict
                for parent_prop in &parent_class.properties {
                    if !all_properties.iter().any(|p| p.name == parent_prop.name) {
                        all_properties.push(parent_prop.clone());
                    }
                }
            }
        }

        // Build properties
        let mut properties = Map::new();
        let mut pattern_properties = Map::new();
        let mut required = Vec::new();

        for prop in &all_properties {
            if prop.is_hidden() {
                continue;
            }

            let prop_schema = self.build_property_schema(prop);

            // Handle modifier-aware properties (test-* prefix support)
            if prop.is_modifier_aware() {
                let pattern = if prop.name.starts_with("test-") {
                    format!("^{}(@.+)?$", prop.name)
                } else {
                    format!("^(test-)?{}(@.+)?$", prop.name)
                };
                pattern_properties.insert(pattern, prop_schema.clone());
            }

            properties.insert(prop.name.clone(), prop_schema);

            // Mark as required if not nullable and no default
            if !prop.is_nullable && prop.default_value.is_none() {
                required.push(prop.name.clone());
            }
        }

        let mut schema_obj = json!({
            "type": "object",
            "additionalProperties": false,
        });

        if let Some(obj) = schema_obj.as_object_mut() {
            if !properties.is_empty() {
                obj.insert("properties".to_string(), Value::Object(properties));
            }
            if !pattern_properties.is_empty() {
                obj.insert("patternProperties".to_string(), Value::Object(pattern_properties));
            }
            if !required.is_empty() && required.len() < all_properties.len() {
                // Only add required if not all properties are required
                obj.insert(
                    "required".to_string(),
                    Value::Array(required.into_iter().map(Value::String).collect()),
                );
            }
            if let Some(doc) = &class.doc {
                obj.insert("title".to_string(), Value::String(doc.clone()));
            }
        }

        self.definitions.insert(name.clone(), schema_obj);
    }

    fn build_property_schema(&mut self, prop: &Property) -> Value {
        let base_schema = self.build_type_schema(&prop.type_name, prop);

        let mut schema = if prop.is_list {
            json!({
                "type": "array",
                "items": base_schema,
                "uniqueItems": true
            })
        } else if prop.is_map {
            json!({
                "type": "array",
                "items": {
                    "type": "object",
                    "patternProperties": {
                        "^[^@+:]+$": base_schema
                    }
                },
                "uniqueItems": true
            })
        } else {
            base_schema
        };

        // Add documentation
        if let Some(doc) = &prop.doc {
            if let Some(obj) = schema.as_object_mut() {
                obj.insert("description".to_string(), Value::String(doc.clone()));
                obj.insert("title".to_string(), Value::String(short_doc(doc)));
            }
        }

        // Add x-intellij-metadata for platform/product specificity
        let platforms = prop.get_platform_specific();
        let product_types = prop.get_product_type_specific();
        
        if !platforms.is_empty() || !product_types.is_empty() {
            let mut metadata = Map::new();
            if !platforms.is_empty() {
                metadata.insert(
                    "platforms".to_string(),
                    Value::Array(platforms.into_iter().map(Value::String).collect()),
                );
            }
            if !product_types.is_empty() {
                metadata.insert(
                    "productTypes".to_string(),
                    Value::Array(product_types.into_iter().map(Value::String).collect()),
                );
            }
            if let Some(obj) = schema.as_object_mut() {
                obj.insert("x-intellij-metadata".to_string(), Value::Object(metadata));
            }
        }

        schema
    }

    fn build_type_schema(&mut self, type_name: &str, _prop: &Property) -> Value {
        // Check if it's an enum
        if let Some(enum_def) = self.context.enums.get(type_name) {
            return self.build_enum_schema(enum_def);
        }

        // Check if it's a class
        if let Some(class) = self.context.classes.get(type_name) {
            self.build_class_definition(class);
            return json!({ "$ref": format!("#/$defs/{}", type_name) });
        }

        // Check for TraceableEnum wrapper
        if type_name.starts_with("TraceableEnum<") {
            if let Some(inner) = type_name.strip_prefix("TraceableEnum<").and_then(|s| s.strip_suffix('>')) {
                if let Some(enum_def) = self.context.enums.get(inner) {
                    return self.build_enum_schema(enum_def);
                }
            }
        }

        // Primitive types
        match type_name {
            "String" | "TraceableString" => json!({ "type": "string" }),
            "Int" | "Integer" => json!({ "type": "integer" }),
            "Boolean" => json!({ "type": "boolean" }),
            "Path" | "TraceablePath" => json!({ "type": "string" }),
            "Double" | "Float" => json!({ "type": "number" }),
            _ => {
                // Unknown type - treat as string with a warning in the schema
                json!({
                    "type": "string",
                    "description": format!("Type: {}", type_name)
                })
            }
        }
    }

    fn build_enum_schema(&self, enum_def: &EnumDef) -> Value {
        let values: Vec<String> = enum_def
            .entries
            .iter()
            .filter(|e| !e.is_outdated)
            .map(|e| e.schema_value.clone())
            .collect();

        let mut schema = json!({
            "enum": values
        });

        // Add enum metadata
        let metadata: Map<String, Value> = enum_def
            .entries
            .iter()
            .filter(|e| !e.is_outdated && e.doc.is_some())
            .map(|e| {
                (
                    e.schema_value.clone(),
                    Value::String(e.doc.as_ref().unwrap().clone()),
                )
            })
            .collect();

        if !metadata.is_empty() {
            if let Some(obj) = schema.as_object_mut() {
                obj.insert("x-intellij-enum-metadata".to_string(), Value::Object(metadata));
            }
        }

        if enum_def.is_order_sensitive {
            if let Some(obj) = schema.as_object_mut() {
                obj.insert("x-intellij-enum-order-sensitive".to_string(), Value::Bool(true));
            }
        }

        schema
    }
}

/// Extract short form of documentation
fn short_doc(doc: &str) -> String {
    doc.replace("[Read more]", "")
        .replace(|c: char| c == '(' || c == ')', "")
        .trim()
        .trim_end_matches('.')
        .to_string()
}
