// src/commands/undo-redo-handler.ts
import * as vscode from "vscode";
import { formatErrorValue } from "../utils";
import { extensionContext } from "../utils/extension-context";
import { logger } from "../utils/logger";

/**
 * Handles enhanced undo/redo support for batch rename operations
 */
export class UndoRedoHandler {
  /**
   * Registers undo/redo command handlers
   */
  public register(): vscode.Disposable[] {
    const undoCommand = vscode.commands.registerCommand(
      "batchRename.undo",
      this.handleUndo.bind(this),
    );
    const redoCommand = vscode.commands.registerCommand(
      "batchRename.redo",
      this.handleRedo.bind(this),
    );

    // Register keyboard shortcut overrides
    const disposables: vscode.Disposable[] = [undoCommand, redoCommand];

    // Listen for undo/redo events from VSCode
    const undoListener = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.contentChanges.length > 0) {
        if (e.reason === vscode.TextDocumentChangeReason.Undo) {
          logger.debug(
            `Detected undo operation in document: ${formatErrorValue(e.document.uri)}`,
          );
          void this.prepareUndoContext();
        } else if (e.reason === vscode.TextDocumentChangeReason.Redo) {
          logger.debug(
            `Detected redo operation in document: ${formatErrorValue(e.document.uri)}`,
          );
          void this.prepareRedoContext();
        }
      }
    });

    disposables.push(undoListener);
    return disposables;
  }

  /**
   * Handle custom undo command
   */
  private async handleUndo(): Promise<void> {
    logger.debug("Custom undo command triggered");

    if (await this.prepareUndoContext()) {
      await vscode.commands.executeCommand("undo");
    } else {
      // Fall back to standard undo
      await vscode.commands.executeCommand("undo");
    }
  }

  /**
   * Handle custom redo command
   */
  private async handleRedo(): Promise<void> {
    logger.debug("Custom redo command triggered");

    if (await this.prepareRedoContext()) {
      await vscode.commands.executeCommand("redo");
    } else {
      // Fall back to standard redo
      await vscode.commands.executeCommand("redo");
    }
  }

  /**
   * Prepares the editor context for undo operation
   * @returns Whether context was successfully prepared
   */
  private async prepareUndoContext(): Promise<boolean> {
    const targetUris = extensionContext.getWorkspaceState<string[]>(
      "batchRename.targetUris",
    );
    if (!targetUris || targetUris.length === 0) {
      return false;
    }

    // Try each URI in sequence until one works
    for (const uriStr of targetUris) {
      try {
        const uri = vscode.Uri.parse(uriStr);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: true });
        logger.debug(`Restored undo context with: ${uriStr}`);
        return true;
      } catch (error) {
        logger.debug(`Could not open ${uriStr}: ${formatErrorValue(error)}`);
        logger.debug(`Trying next URI`);
        // Try next URI
      }
    }

    // Create a temporary document as last resort
    try {
      const content = `// Temporary document for undo context\n// ${new Date().toISOString()}\n`;
      const doc = await vscode.workspace.openTextDocument({
        content,
        language: "plaintext",
      });
      await vscode.window.showTextDocument(doc, { preview: true });
      logger.debug("Created temporary document for undo context");
      return true;
    } catch (error) {
      logger.warn(`Failed to create undo context: ${formatErrorValue(error)}`);
      return false;
    }
  }

  /**
   * Prepares the editor context for redo operation
   * @returns Whether context was successfully prepared
   */
  private async prepareRedoContext(): Promise<boolean> {
    // Similar implementation to prepareUndoContext
    return this.prepareUndoContext();
  }
}
