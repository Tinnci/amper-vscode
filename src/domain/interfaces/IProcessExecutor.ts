export interface IProcessExecutor {
  /**
   * Execute a command with arguments in a given working directory.
   * Returns stdout as a string (trimmed). Throws on non-zero exit.
   */
  exec(command: string, args: string[], cwd: string): Promise<string>;
}
