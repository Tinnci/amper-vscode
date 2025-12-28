import * as vscode from 'vscode';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    OFF = 4
}

export class Logger {
    private static instance: Logger;
    private outputChannel: vscode.LogOutputChannel;

    private constructor() {
        // VS Code's LogOutputChannel provides native timestamping and log level filtering
        this.outputChannel = vscode.window.createOutputChannel('Amper Logs', { log: true });
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public static debug(message: string, ...args: any[]): void {
        Logger.getInstance().outputChannel.debug(Logger.format(message, args));
    }

    public static info(message: string, ...args: any[]): void {
        Logger.getInstance().outputChannel.info(Logger.format(message, args));
    }

    public static warn(message: string, ...args: any[]): void {
        Logger.getInstance().outputChannel.warn(Logger.format(message, args));
    }

    public static error(message: string, error?: any, ...args: any[]): void {
        const errorMessage = error instanceof Error ? error.stack || error.message : String(error);
        Logger.getInstance().outputChannel.error(Logger.format(message, args) + (error ? `\nReason: ${errorMessage}` : ''));
    }

    public static show(): void {
        Logger.getInstance().outputChannel.show();
    }

    public static getChannel(): vscode.LogOutputChannel {
        return Logger.getInstance().outputChannel;
    }

    private static format(message: string, args: any[]): string {
        if (!args || args.length === 0) {
            return message;
        }
        return message + ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    }
}
