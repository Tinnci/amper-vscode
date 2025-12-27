import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { IProjectRepository } from '../../domain/repositories/IProjectRepository';
import { AmperProject } from '../../domain/models/AmperProject';
import { AmperModule } from '../../domain/models/AmperModule';

export class FileSystemProjectRepository implements IProjectRepository {
  async findProject(rootPath: string): Promise<AmperProject | null> {
    const isWindows = process.platform === 'win32';
    const wrapperName = isWindows ? 'amper.bat' : 'amper';
    const wrapperPath = path.join(rootPath, wrapperName);

    if (!fs.existsSync(wrapperPath)) {
      return null;
    }

    const modules = this.findModules(rootPath, rootPath);
    return new AmperProject(rootPath, modules);
  }

  private findModules(dir: string, rootPath: string): AmperModule[] {
    const modules: AmperModule[] = [];
    const files = fs.readdirSync(dir);

    if (files.includes('module.yaml')) {
      const moduleYamlPath = path.join(dir, 'module.yaml');
      const content = fs.readFileSync(moduleYamlPath, 'utf8');
      try {
        const parsed = yaml.parse(content);
        const type = typeof parsed?.product === 'string' ? parsed.product : (parsed?.product?.type || 'unknown');
        const name = path.basename(dir);
        modules.push(new AmperModule(name, dir, type));
      } catch (e) {
        console.error(`Failed to parse ${moduleYamlPath}`, e);
      }
    }

    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory() && file !== 'node_modules' && file !== '.git' && file !== 'build') {
        modules.push(...this.findModules(fullPath, rootPath));
      }
    }

    return modules;
  }
}
