import * as fs from 'fs';
import * as path from 'path';
import { AmperTemplate, DEFAULT_TEMPLATES } from '../entities/AmperTemplate';

/**
 * Repository for discovering Amper project templates.
 * 
 * Templates can be discovered from:
 * 1. Amper source code (if vendor submodule is available)
 * 2. Default hardcoded list (fallback)
 */
export interface ITemplateRepository {
    /**
     * Get all available templates.
     * Returns cached templates if available, otherwise discovers them.
     */
    getTemplates(): AmperTemplate[];

    /**
     * Force refresh the template list from source.
     */
    refreshTemplates(): AmperTemplate[];
}

/**
 * File-system based template repository.
 * Discovers templates from the Amper vendor submodule.
 */
export class FileSystemTemplateRepository implements ITemplateRepository {
    private cachedTemplates: AmperTemplate[] | null = null;
    private readonly extensionPath: string;

    constructor(extensionPath: string) {
        this.extensionPath = extensionPath;
    }

    getTemplates(): AmperTemplate[] {
        if (this.cachedTemplates) {
            return this.cachedTemplates;
        }
        return this.refreshTemplates();
    }

    refreshTemplates(): AmperTemplate[] {
        try {
            const templates = this.discoverTemplatesFromSource();
            if (templates.length > 0) {
                this.cachedTemplates = templates;
                return templates;
            }
        } catch {
            // Fall through to default
        }

        this.cachedTemplates = DEFAULT_TEMPLATES;
        return DEFAULT_TEMPLATES;
    }

    /**
     * Discover templates from Amper source code.
     * Parses the ProjectTemplatesBundle.properties file.
     */
    private discoverTemplatesFromSource(): AmperTemplate[] {
        const bundlePath = path.join(
            this.extensionPath,
            'vendor/amper/sources/amper-project-templates/resources/messages/ProjectTemplatesBundle.properties'
        );

        if (!fs.existsSync(bundlePath)) {
            return [];
        }

        const content = fs.readFileSync(bundlePath, 'utf-8');
        const templates = new Map<string, Partial<AmperTemplate>>();

        // Parse each line
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }

            // Match: template.<id>.name=<value> or template.<id>.description=<value>
            const match = trimmed.match(/^template\.([^.]+)\.(name|description)=(.+)$/);
            if (match) {
                const [, id, field, value] = match;

                if (!templates.has(id)) {
                    templates.set(id, { id });
                }

                const template = templates.get(id)!;
                if (field === 'name') {
                    template.label = value;
                } else if (field === 'description') {
                    template.description = value;
                }
            }
        }

        // Filter complete templates and sort by label
        const result: AmperTemplate[] = [];
        for (const [id, template] of templates) {
            if (template.label && template.description) {
                result.push({
                    id,
                    label: template.label,
                    description: template.description
                });
            }
        }

        return result.sort((a, b) => a.label.localeCompare(b.label));
    }
}
