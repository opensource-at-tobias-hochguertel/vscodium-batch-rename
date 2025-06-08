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
export const logger = Logger.getInstance();
