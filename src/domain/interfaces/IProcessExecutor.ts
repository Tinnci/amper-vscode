export interface ExecutionOptions {
  cwd?: string;
  env?: { [key: string]: string };
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

export interface IProcessExecutor {
  /**
   * Execute a command with arguments.
   * Returns stdout as a string (trimmed). Throws on non-zero exit.
   */
  exec(command: string, args: string[], options?: ExecutionOptions): Promise<string>;

  /**
   * Execute a command and attempt to parse the output as JSON.
   */
  execJson<T>(command: string, args: string[], options?: ExecutionOptions): Promise<T>;
}
