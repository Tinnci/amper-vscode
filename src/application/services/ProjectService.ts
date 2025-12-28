import * as fs from 'fs';
import * as path from 'path';
import { IProcessExecutor } from '../../domain/interfaces/IProcessExecutor';

export interface AmperTemplate {
    id: string;
    label: string;
    description: string;
}

export class ProjectService {
    constructor(private executor: IProcessExecutor) { }

    getTemplates(): AmperTemplate[] {
        return [
            { id: 'jvm-cli', label: 'JVM console application', description: 'A plain JVM console application' },
            { id: 'android-app', label: 'Android application (Jetpack Compose)', description: 'An Android application using Jetpack Compose' },
            { id: 'compose-app', label: 'Compose Multiplatform application', description: 'Android, iOS, and JVM desktop applications sharing UI' },
            { id: 'ios-app', label: 'iOS application (Compose Multiplatform)', description: 'An iOS application using Compose Multiplatform' },
            { id: 'jvm-gui', label: 'JVM GUI application (Compose Multiplatform)', description: 'A JVM application using Compose Multiplatform for Desktop' },
            { id: 'kotlin-lib', label: 'Kotlin Multiplatform library', description: 'A multiplatform library targeting Android, iOS, and the JVM' },
            { id: 'ktor-app', label: 'Ktor server application', description: 'A Ktor server application with the Netty engine' },
            { id: 'multiplatform-cli', label: 'Multiplatform CLI application', description: 'Targeting JVM, Linux, macOS, and Windows native' },
            { id: 'spring-boot-java', label: 'Spring Boot application (Java)', description: 'A Spring Boot application written in Java' },
            { id: 'spring-boot-kotlin', label: 'Spring Boot application (Kotlin)', description: 'A Spring Boot application written in Kotlin' },
        ];
    }

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

        // 2. Run init
        await this.executor.exec('amper', ['init', templateId], { cwd: projectPath });
    }

    async runTool(toolName: string, args: string[], projectPath: string): Promise<string> {
        return this.executor.exec('amper', ['tool', toolName, ...args], { cwd: projectPath });
    }

    async getJdkInfo(projectPath: string): Promise<string> {
        return this.runTool('jdk', [], projectPath);
    }
}
