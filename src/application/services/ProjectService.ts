import * as fs from 'fs';
import * as path from 'path';
import { IProcessExecutor } from '../../domain/interfaces/IProcessExecutor';
import { AmperTemplate, DEFAULT_TEMPLATES } from '../../domain/entities/AmperTemplate';
import { ITemplateRepository } from '../../domain/repositories/ITemplateRepository';

export { AmperTemplate };

export class ProjectService {
    private templateRepository: ITemplateRepository | null = null;

    constructor(private executor: IProcessExecutor) { }

    /**
     * Set the template repository for dynamic template discovery.
     */
    setTemplateRepository(repo: ITemplateRepository): void {
        this.templateRepository = repo;
    }

    /**
     * Get available project templates.
     * Uses dynamic discovery if available, otherwise returns defaults.
     */
    getTemplates(): AmperTemplate[] {
        if (this.templateRepository) {
            return this.templateRepository.getTemplates();
        }
        return DEFAULT_TEMPLATES;
    }

    /**
     * Refresh the template list from source.
     */
    refreshTemplates(): AmperTemplate[] {
        if (this.templateRepository) {
            return this.templateRepository.refreshTemplates();
        }
        return DEFAULT_TEMPLATES;
    }

    /**
     * Initialize a new Amper project using a template.
     */
    async initializeProject(projectPath: string, templateId: string): Promise<void> {
        if (!fs.existsSync(projectPath)) {
            fs.mkdirSync(projectPath, { recursive: true });
        }

        const isWindows = process.platform === 'win32';
        const wrapperName = isWindows ? 'amper.bat' : 'amper';
        const wrapperPath = path.join(projectPath, wrapperName);

        // 1. Download wrapper if missing
        if (!fs.existsSync(wrapperPath)) {
            const url = isWindows
                ? 'https://jb.gg/amper/wrapper.bat'
                : 'https://jb.gg/amper/wrapper.sh';

            // Use curl to download (available on Win10+ and Unix)
            await this.executor.exec('curl', ['-fsSL', '-o', wrapperName, url], { cwd: projectPath });

            if (!isWindows) {
                await this.executor.exec('chmod', ['+x', wrapperName], { cwd: projectPath });
            }
        }

        // 2. Run init with the template ID
        await this.executor.exec('amper', ['init', templateId], { cwd: projectPath });
    }

    /**
     * Run an Amper tool command.
     */
    async runTool(toolName: string, args: string[], projectPath: string): Promise<string> {
        return this.executor.exec('amper', ['tool', toolName, ...args], { cwd: projectPath });
    }

    /**
     * Get JDK information for the project.
     */
    async getJdkInfo(projectPath: string): Promise<string> {
        return this.runTool('jdk', [], projectPath);
    }
}
