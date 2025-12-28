import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { JdkInfo } from '../../domain/models/JdkInfo';

export class FileSystemJdkRepository {
    getAmperCachePath(): string {
        if (os.platform() === 'win32') {
            return path.join(process.env.LOCALAPPDATA || '', 'JetBrains', 'Amper');
        } else if (os.platform() === 'darwin') {
            return path.join(os.homedir(), 'Library', 'Caches', 'JetBrains', 'Amper');
        } else {
            return path.join(os.homedir(), '.cache', 'JetBrains', 'Amper');
        }
    }

    async getInstalledJdks(): Promise<JdkInfo[]> {
        const cachePath = this.getAmperCachePath();
        if (!fs.existsSync(cachePath)) {
            return [];
        }

        const dirs = fs.readdirSync(cachePath);
        const jdks: JdkInfo[] = [];

        for (const dir of dirs) {
            // Look for directories that look like JDKs/JREs (e.g., zulu..., openjdk...)
            if (dir.includes('jre') || dir.includes('jdk') || dir.includes('zulu')) {
                const fullPath = path.join(cachePath, dir);
                if (fs.statSync(fullPath).isDirectory()) {
                    jdks.push({
                        id: dir,
                        name: dir,
                        version: this.extractVersion(dir),
                        path: fullPath,
                        type: dir.toLowerCase().includes('jre') ? 'JRE' : 'JDK'
                    });
                }
            }
        }

        return jdks;
    }

    private extractVersion(dirName: string): string {
        // Simple regex to extract something that looks like a version
        const match = dirName.match(/(\d+\.\d+\.\d+)/);
        return match ? match[1] : 'Unknown';
    }
}
