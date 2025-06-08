// src/utils/logger.ts
import * as vscode from "vscode";
import { LogLevel } from "../types";

/**
 * Centralized logger for the extension with different log levels
 */
export class Logger {
  private static instance: Logger;
  private outputChannel: vscode.OutputChannel;
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel("Batch Rename");
  }

  /**
   * Get the singleton instance of the logger
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Set the minimum log level to display
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Get the current log level
   */
  public getLogLevel(): LogLevel {
    return this.logLevel;
  }

  /**
   * Log a message with the specified level
   */
  private log(level: LogLevel, message: string): void {
    if (level < this.logLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = LogLevel[level].padEnd(5, " ");
    this.outputChannel.appendLine(`[${timestamp}] ${prefix} - ${message}`);
  }

  /**
   * Show the output channel
   */
  public show(): void {
    this.outputChannel.show();
  }

  /**
   * Log a trace message
   */
  public trace(message: string): void {
    this.log(LogLevel.TRACE, message);
  }

  /**
   * Log a debug message
   */
  public debug(message: string): void {
    this.log(LogLevel.DEBUG, message);
  }

  /**
   * Log an info message
   */
  public info(message: string): void {
    this.log(LogLevel.INFO, message);
  }

  /**
   * Log a warning message
   */
  public warn(message: string): void {
    this.log(LogLevel.WARN, message);
  }

  /**
   * Log an error message
   */
  public error(message: string): void {
    this.log(LogLevel.ERROR, message);
  }

  /**
   * Log a fatal error message
   */
  public fatal(message: string): void {
    this.log(LogLevel.FATAL, message);
  }

  /**
   * Clear the output channel
   */
  public clear(): void {
    this.outputChannel.clear();
  }

  /**
   * Dispose the output channel
   */
  public dispose(): void {
    this.outputChannel.dispose();
  }
}

/**
 * Export a singleton instance of the logger
 */
// export const logger = Logger.getInstance();

/**
 * Enhanced logger for VSCode extensions with undo/redo debugging support
 */
export class ExtensionLogger {
  private outputChannel: vscode.OutputChannel;
  private readonly extensionName: string;
  private debugEnabled: boolean = false;
  private logBuffer: string[] = [];
  private readonly bufferSize: number = 1000;

  constructor(extensionName: string) {
    this.extensionName = extensionName;
    this.outputChannel = vscode.window.createOutputChannel(this.extensionName);

    // Check if debug is enabled via settings
    this.updateDebugMode();

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("batchRename.debugMode")) {
        this.updateDebugMode();
      }
    });
  }

  private updateDebugMode(): void {
    const config = vscode.workspace.getConfiguration("batchRename");
    this.debugEnabled = config.get("debugMode", false);
    this.log(
      "debug",
      `Debug mode ${this.debugEnabled ? "enabled" : "disabled"}`,
    );
  }

  /**
   * Log a message with a specific level
   */
  private log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
  ): void {
    // Skip debug messages if debug mode is disabled
    if (level === "debug" && !this.debugEnabled) {
      return;
    }

    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${level.toUpperCase().padEnd(5)}  - ${message}`;

    // Store in buffer for diagnostic purposes
    this.logBuffer.push(formattedMessage);
    if (this.logBuffer.length > this.bufferSize) {
      this.logBuffer.shift();
    }

    // Output to VSCode channel
    this.outputChannel.appendLine(formattedMessage);
  }

  /**
   * Log debug information (only shown when debug mode is enabled)
   */
  public debug(message: string): void {
    this.log("debug", message);
  }

  /**
   * Log informational messages
   */
  public info(message: string): void {
    this.log("info", message);
  }

  /**
   * Log warning messages
   */
  public warn(message: string): void {
    this.log("warn", message);
  }

  /**
   * Log error messages
   */
  public error(message: string): void {
    this.log("error", message);
  }

  /**
   * Show the output channel
   */
  public show(): void {
    this.outputChannel.show();
  }

  /**
   * Get the entire log buffer (for diagnostic purposes)
   */
  public getLogBuffer(): string[] {
    return [...this.logBuffer];
  }

  /**
   * Export logs to a file for diagnostic purposes
   */
  public async exportLogs(): Promise<void> {
    const document = await vscode.workspace.openTextDocument({
      content: this.logBuffer.join("\n"),
      language: "log",
    });

    await vscode.window.showTextDocument(document);
  }
}

// Create and export the logger instance
export const logger = new ExtensionLogger("Batch Rename");
