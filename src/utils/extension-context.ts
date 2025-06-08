// src/utils/extensionContext.ts
import * as path from "path";
import * as vscode from "vscode";
import { logger } from "./logger";

/**
 * Type-safe extension context access for VSCode extensions
 *
 * Provides centralized context management with proper typing support
 * for all state operations across the extension lifecycle.
 */
export class ExtensionContextManager {
  private static instance: ExtensionContextManager | undefined;
  private _context: vscode.ExtensionContext | undefined;

  private constructor() {
    // Private constructor enforces singleton pattern
  }

  /**
   * Get the singleton instance of the context manager
   */
  public static getInstance(): ExtensionContextManager {
    if (!ExtensionContextManager.instance) {
      ExtensionContextManager.instance = new ExtensionContextManager();
    }
    return ExtensionContextManager.instance;
  }

  /**
   * Initialize with VSCode extension context
   * @param context The extension context from activation
   */
  public initialize(context: vscode.ExtensionContext): void {
    this._context = context;

    logger.debug("Extension context initialized");
  }

  /**
   * Get the extension context if available
   * @returns The extension context or undefined
   */
  public getContext(): vscode.ExtensionContext | undefined {
    return this._context;
  }

  /**
   * Store value in workspace state
   * @param key The state key
   * @param value The value to store
   * @returns Promise resolving to success status
   */
  public async storeWorkspaceState<T>(key: string, value: T): Promise<boolean> {
    if (!this._context) {
      logger.warn(`Cannot store '${key}': Extension context unavailable`);
      return false;
    }

    try {
      await this._context.workspaceState.update(key, value);
      return true;
    } catch (error) {
      logger.error(
        `Failed to store workspace state '${key}': ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Retrieve value from workspace state
   * @param key The state key
   * @param defaultValue Optional default value
   * @returns The stored value, default value, or undefined
   */
  public getWorkspaceState<T>(key: string, defaultValue?: T): T | undefined {
    if (!this._context) {
      logger.warn(
        `Cannot retrieve workspace state: extension context unavailable`,
      );
      return defaultValue;
    }

    // Handle the two overload cases properly
    return defaultValue !== undefined
      ? this._context.workspaceState.get<T>(key, defaultValue)
      : this._context.workspaceState.get<T>(key);
  }

  /**
   * Store data in global state (persists across sessions)
   * @param key State key
   * @param value Value to store
   * @returns Promise that resolves when storage is complete
   */
  public async storeGlobalState<T>(key: string, value: T): Promise<boolean> {
    if (!this._context) {
      logger.warn(
        `Cannot store global '${key}': Extension context unavailable`,
      );
      return false;
    }

    try {
      await this._context.globalState.update(key, value);
      return true;
    } catch (error) {
      logger.error(
        `Failed to store global state '${key}': ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Retrieve a value from global state with proper type handling
   * @param key Storage key
   * @param defaultValue Optional default value if key not found
   * @returns The stored value, default value, or undefined
   */
  public getGlobalState<T>(key: string, defaultValue?: T): T | undefined {
    if (!this._context) {
      logger.warn(
        `Cannot retrieve global state: extension context unavailable`,
      );
      return defaultValue;
    }

    // Handle the two overload cases properly
    return defaultValue !== undefined
      ? this._context.globalState.get<T>(key, defaultValue)
      : this._context.globalState.get<T>(key);
  }

  /**
   * Creates a URI for a resource in the extension
   * @param relativePath Path relative to the extension directory
   * @returns URI for the resource or undefined if context not available
   */
  public getResourceUri(relativePath: string): vscode.Uri | undefined {
    if (!this._context) {
      logger.warn(`Cannot get resource URI: Extension context unavailable`);
      return undefined;
    }

    try {
      // Cross-version compatible approach
      if (this._context.extensionUri) {
        // Try using extensionUri.path (newer VSCode versions)
        const basePath = this._context.extensionUri.path;
        const fullPath = path.posix.join(basePath, relativePath);
        return this._context.extensionUri.with({ path: fullPath });
      } else if (this._context.extensionPath) {
        // Fallback to extensionPath (older VSCode versions)
        const fullPath = path.join(this._context.extensionPath, relativePath);
        return vscode.Uri.file(fullPath);
      }

      logger.warn(
        `Cannot determine extension path for resource: ${relativePath}`,
      );
      return undefined;
    } catch (error) {
      logger.error(
        `Failed to get resource URI for '${relativePath}': ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  /**
   * Register a disposable with the extension context
   * @param disposable The disposable to register
   * @returns True if registration was successful
   */
  public registerDisposable(disposable: vscode.Disposable): boolean {
    if (!this._context) {
      logger.warn(`Cannot register disposable: Extension context unavailable`);
      return false;
    }

    try {
      this._context.subscriptions.push(disposable);
      return true;
    } catch (error) {
      logger.error(
        `Failed to register disposable: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}

// Export singleton instance for convenience
export const extensionContext = ExtensionContextManager.getInstance();
