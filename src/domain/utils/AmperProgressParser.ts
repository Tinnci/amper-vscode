export class AmperProgressParser {
    /**
     * Regex for task execution in Amper/Gradle output:
     * Format: "> Task :module:taskName" or "Task :module:taskName"
     */
    private static taskRegex = /(?:> )?Task\s+(:[\w\-:]+)/;

    /**
     * Extract the currently executing task from a log line
     */
    public static parseLine(line: string): string | undefined {
        const match = line.match(this.taskRegex);
        if (match) {
            return match[1];
        }
        return undefined;
    }

    /**
     * Some Amper tasks show high-level steps like [1/5]
     */
    private static stepRegex = /\[(\d+)\/(\d+)\]/;

    public static parseStep(line: string): { current: number, total: number } | undefined {
        const match = line.match(this.stepRegex);
        if (match) {
            return {
                current: parseInt(match[1]),
                total: parseInt(match[2])
            };
        }
        return undefined;
    }
}
