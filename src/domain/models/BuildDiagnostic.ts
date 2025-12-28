export enum DiagnosticSeverity {
    Error = 'error',
    Warning = 'warning',
    Info = 'info'
}

export interface BuildDiagnostic {
    severity: DiagnosticSeverity;
    message: string;
    file?: string;
    line?: number;
    column?: number;
    code?: string;
    source?: string; // e.g., 'Amper', 'Kotlin', 'Gradle'
    relatedLink?: string; // Link to documentation
}

export interface BuildResult {
    success: boolean;
    duration: number; // in milliseconds
    diagnostics: BuildDiagnostic[];
    rawOutput: string;
    timestamp: Date;
    moduleName?: string;
    taskName?: string;
}
