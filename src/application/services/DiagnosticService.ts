import { BuildDiagnostic, BuildResult, DiagnosticSeverity } from '../../domain/models/BuildDiagnostic';

export class DiagnosticService {
    parseBuildOutput(output: string, success: boolean, duration: number, moduleName?: string, taskName?: string): BuildResult {
        const diagnostics: BuildDiagnostic[] = [];
        const lines = output.split('\n');

        // Regex for standard Kotlin/Amper errors: e: file:line:col: message
        // Example: e: C:\Project\src\Main.kt:10:15: Unresolved reference: foo
        const kotlinErrorRegex = /^(e|w):\s+(.*?):(\d+):(\d+):\s+(.*)/;

        // Regex for generic task failures
        const taskFailRegex = /Task\s+'(.*?)'\s+failed/;

        for (const line of lines) {
            const trimmed = line.trim();
            const match = trimmed.match(kotlinErrorRegex);

            if (match) {
                const [, type, file, lineNum, colNum, msg] = match;
                diagnostics.push({
                    severity: type === 'e' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
                    file: file,
                    line: parseInt(lineNum, 10),
                    column: parseInt(colNum, 10),
                    message: msg,
                    source: 'Kotlin'
                });
            } else if (trimmed.startsWith('FAILURE:')) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    message: trimmed,
                    source: 'Build'
                });
            }
        }

        return {
            success,
            duration,
            diagnostics,
            rawOutput: output,
            timestamp: new Date(),
            moduleName,
            taskName
        };
    }
}
