import { BuildDiagnostic, BuildResult, DiagnosticSeverity } from '../../domain/models/BuildDiagnostic';

export class DiagnosticService {
    parseBuildOutput(output: string, success: boolean, duration: number, moduleName?: string, taskName?: string): BuildResult {
        const diagnostics: BuildDiagnostic[] = [];
        const lines = output.split('\n');

        // Regex for Amper/Kotlin errors
        // Matches: "e: C:\Path\file.kt:10:5: message" OR "C:\Path\file.yaml:10:5: message"
        // Group 1: Optional prefix (e|w)
        // Group 2: File path (greedy until the next :line:col pattern)
        // Group 3: Line
        // Group 4: Column
        // Group 5: Message
        const errorRegex = /^(?:([ew]):\s+)?(.*?):(\d+):(\d+):\s+(.*)$/;

        for (const line of lines) {
            const trimmed = line.trim();
            // Skip empty or tree characters for now (unless we implement multi-line parsing)
            if (!trimmed || trimmed.startsWith('├──') || trimmed.startsWith('╰──')) { continue; }

            const match = trimmed.match(errorRegex);

            if (match) {
                const [, prefix, file, lineNum, colNum, msg] = match;
                const severity = prefix === 'w' ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error;

                const diagnostic: BuildDiagnostic = {
                    severity,
                    file: file.trim(),
                    line: parseInt(lineNum, 10),
                    column: parseInt(colNum, 10),
                    message: msg.trim(),
                    source: this.determineSource(file)
                };

                this.enhanceDiagnostic(diagnostic);
                diagnostics.push(diagnostic);
            } else if (trimmed.startsWith('FAILURE:') || trimmed.includes('BUILD FAILED')) {
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

    private determineSource(file: string): string {
        if (file.endsWith('.kt') || file.endsWith('.kts')) { return 'Kotlin'; }
        if (file.endsWith('module.yaml')) { return 'Amper'; }
        return 'Build';
    }

    private enhanceDiagnostic(diagnostic: BuildDiagnostic): void {
        const msg = diagnostic.message.toLowerCase();

        // Map known errors to documentation or actions
        if (msg.includes('license') && msg.includes('jdk')) {
            diagnostic.relatedLink = 'https://www.jetbrains.com/legal/java/';
            diagnostic.message += ' (License acceptance required)';
        }
        else if (msg.includes('android') && msg.includes('minSdk')) {
            diagnostic.relatedLink = 'https://developer.android.com/guide/topics/manifest/uses-sdk-element';
        }
        else if (msg.includes('unresolved reference')) {
            // Common Kotlin error
            diagnostic.relatedLink = 'https://kotlinlang.org/docs/referenced-symbols.html';
        }
    }
}
