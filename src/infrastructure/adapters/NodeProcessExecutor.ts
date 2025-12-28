import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IProcessExecutor, ExecutionOptions } from '../../domain/interfaces/IProcessExecutor';

export class NodeProcessExecutor implements IProcessExecutor {
  async exec(command: string, args: string[], options?: ExecutionOptions): Promise<string> {
    const isWindows = os.platform() === 'win32';
    const cwd = options?.cwd || process.cwd();

    // Special handling for Amper wrapper to be robust across OSes
    if (command === 'amper') {
      if (isWindows) {
        const bat = path.join(cwd, 'amper.bat');
        if (!fs.existsSync(bat)) {
          throw new Error('Amper wrapper not found: expected amper.bat in workspace root');
        }
        return this.spawnCollect('cmd', ['/c', 'amper.bat', ...args], false, options);
      } else {
        const sh = path.join(cwd, 'amper');
        if (!fs.existsSync(sh)) {
          throw new Error('Amper wrapper not found: expected ./amper in workspace root');
        }
        return this.spawnCollect(sh, args, false, options);
      }
    }

    // Generic command execution (use shell to support builtins like echo)
    return this.spawnCollect(command, args, true, options);
  }

  async execJson<T>(command: string, args: string[], options?: ExecutionOptions): Promise<T> {
    const output = await this.exec(command, args, options);
    try {
      return JSON.parse(output) as T;
    } catch (err) {
      throw new Error(`Failed to parse JSON output from ${command}: ${output}`);
    }
  }

  private spawnCollect(cmd: string, args: string[], shell: boolean, options?: ExecutionOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const spawnOptions = {
        cwd: options?.cwd,
        env: { ...process.env, ...options?.env },
        shell
      };

      const child = spawn(cmd, args, spawnOptions);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => {
        const str = d.toString();
        stdout += str;
        if (options?.onStdout) {
          options.onStdout(str);
        }
      });

      child.stderr.on('data', (d) => {
        const str = d.toString();
        stderr += str;
        if (options?.onStderr) {
          options.onStderr(str);
        }
      });

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
