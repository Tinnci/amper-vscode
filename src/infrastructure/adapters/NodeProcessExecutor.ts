import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IProcessExecutor } from '../../domain/interfaces/IProcessExecutor';

export class NodeProcessExecutor implements IProcessExecutor {
  async exec(command: string, args: string[], cwd: string): Promise<string> {
    const isWindows = os.platform() === 'win32';

    // Special handling for Amper wrapper to be robust across OSes
    if (command === 'amper') {
      if (isWindows) {
        const bat = path.join(cwd, 'amper.bat');
        if (!fs.existsSync(bat)) {
          throw new Error('Amper wrapper not found: expected amper.bat in workspace root');
        }
        return this.spawnCollect('cmd', ['/c', 'amper.bat', ...args], cwd, false);
      } else {
        const sh = path.join(cwd, 'amper');
        if (!fs.existsSync(sh)) {
          throw new Error('Amper wrapper not found: expected ./amper in workspace root');
        }
        return this.spawnCollect(sh, args, cwd, false);
      }
    }

    // Generic command execution (use shell to support builtins like echo)
    return this.spawnCollect(command, args, cwd, true);
  }

  private spawnCollect(cmd: string, args: string[], cwd: string, shell: boolean): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { cwd, shell });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));

      child.on('error', (err) => reject(err));
      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(stderr.trim() || `Process exited with code ${code}`));
        }
      });
    });
  }
}
