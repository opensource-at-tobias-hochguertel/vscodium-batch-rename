// src/core/atomic-renamer.ts
import * as vscode from "vscode";
import { RenameOperation, RenameResult } from "../types";
import { formatErrorValue } from "../utils/formatters";
import { logger } from "../utils/logger";

/**
 * Provides an alternative implementation for renaming with improved undo/redo support
 */
export class AtomicRenamer {
  /**
   * Performs a batch rename as a single atomic operation with enhanced undo/redo support
   */
  public async renameAtomically(
    operations: RenameOperation[],
  ): Promise<RenameResult> {
    if (operations.length === 0) {
      return { succeeded: 0, failed: [], skipped: 0 };
    }

    const editId = Date.now().toString(36);
    logger.debug(
      `Creating atomic rename operation (ID: ${editId}) with ${operations.length} files`,
    );

    const result: RenameResult = {
      succeeded: 0,
      failed: [],
      skipped: 0,
    };

    try {
      // Create a workspace edit
      const workspaceEdit = new vscode.WorkspaceEdit();

      // Store metadata in the edit
      const metadata = {
        id: editId,
        type: "batchRename",
        count: operations.length,
        timestamp: new Date().toISOString(),
      };

      logger.debug(
        `Creating atomic rename operation: ${JSON.stringify(metadata)}`,
      );

      // Add all operations to the edit
      for (const op of operations) {
        workspaceEdit.renameFile(op.fromUri, op.toUri, {
          overwrite: false,
          ignoreIfExists: false,
        });

        // Add a no-op edit for each file to ensure VSCode tracks it
        // This can help with undo/redo tracking
        try {
          workspaceEdit.set(op.fromUri, [
            // This is a no-op edit that doesn't change the file
            // but helps VSCode track the resource for undo/redo
            new vscode.TextEdit(new vscode.Range(0, 0, 0, 0), ""),
          ]);
        } catch (error) {
          // Non-critical, continue with the rename
          logger.debug(
            `Could not add no-op edit for ${op.fromUri.toString()}: ${formatErrorValue(error)}`,
          );
        }
      }

      // Apply the edit
      logger.debug(
        `Applying atomic workspace edit with ${operations.length} operations`,
      );
      const success = await vscode.workspace.applyEdit(workspaceEdit);

      if (success) {
        logger.debug(
          `Successfully applied atomic workspace edit (ID: ${editId})`,
        );
        result.succeeded = operations.length;

        // Force VSCode to recognize the changes for undo/redo
        await vscode.commands.executeCommand("workbench.action.files.saveAll");

        // Force refresh of Explorer view to show changes
        await vscode.commands.executeCommand(
          "workbench.files.action.refreshFilesExplorer",
        );
      } else {
        logger.error(`Failed to apply atomic workspace edit (ID: ${editId})`);
        result.failed = operations.map((op) => ({
          path: op.from,
          error: "Workspace edit failed to apply",
        }));
      }
    } catch (error) {
      logger.error(`Error during atomic rename: ${formatErrorValue(error)}`);
      result.failed = operations.map((op) => ({
        path: op.from,
        error: error instanceof Error ? error.message : formatErrorValue(error),
      }));
    }

    return result;
  }
}
