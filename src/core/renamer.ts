// src/core/renamer.ts
import * as path from "path";
import * as vscode from "vscode";
import { RenameOperation, RenameRequest, RenameResult } from "../types";
import { fileExists, validateFileName } from "../utils/filesystem";
import { formatErrorValue } from "../utils/formatters";
import { logger } from "../utils/logger";
import { SessionManager } from "./session";

/**
 * Handles batch renaming of files with VSCode workspace edit integration
 * for proper undo/redo support.
 */
export class BatchRenamer {
  private sessionManager: SessionManager;

  /**
   * Create a new BatchRenamer
   * @param sessionManager Session manager for updating file references
   */
  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * Validates a list of rename operations without performing them
   * @param requests Array of rename requests containing paired file and new name
   * @returns Promise resolving to validated rename operations
   */
  public async validateRenameOperations(
    requests: RenameRequest[],
  ): Promise<RenameOperation[]> {
    const operations: RenameOperation[] = [];
    const errors: string[] = [];

    if (requests.length === 0) {
      logger.debug("No rename requests to process");
      return operations;
    }

    // Validate each rename request
    for (const request of requests) {
      const { file, newName } = request;

      // Skip if newName is missing or empty
      if (!newName?.trim()) {
        logger.debug(`Skipping empty new name for: ${file.fsPath}`);
        continue;
      }

      // Validate the new name
      if (!validateFileName(newName)) {
        errors.push(`Invalid filename: "${newName}" contains path separators`);
        continue;
      }

      const newPath = path.join(file.basepath, newName);
      const newUri = vscode.Uri.file(newPath);

      // Skip if no change
      if (file.fsPath === newPath) {
        logger.debug(`Skipping unchanged file: ${file.fsPath}`);
        continue;
      }

      // Check if file exists
      try {
        if (!(await fileExists(file.fsPath))) {
          errors.push(`File not found: ${file.fsPath}`);
          continue;
        }
      } catch (error) {
        errors.push(
          `Error checking file existence for ${file.fsPath}: ${formatErrorValue(error)}`,
        );
        continue;
      }

      // Check if target already exists (unless it's a case-only change)
      try {
        if (
          (await fileExists(newPath)) &&
          file.fsPath.toLowerCase() !== newPath.toLowerCase()
        ) {
          errors.push(`Target already exists: ${newPath}`);
          continue;
        }
      } catch (error) {
        errors.push(
          `Error checking target existence for ${newPath}: ${formatErrorValue(error)}`,
        );
        continue;
      }

      operations.push({
        from: file.fsPath,
        to: newPath,
        fromUri: file.uri,
        toUri: newUri,
      });
    }

    if (errors.length > 0) {
      throw new Error(`Validation errors:\n${errors.join("\n")}`);
    }

    return operations;
  }

  /**
   * Performs batch renaming of files with full undo/redo support
   * @param operations Rename operations to perform
   * @returns Results of the rename operation
   */
  public async renameWithWorkspaceEdit(
    operations: RenameOperation[],
  ): Promise<RenameResult> {
    if (operations.length === 0) {
      return { succeeded: 0, failed: [], skipped: 0 };
    }

    const workspaceEdit = new vscode.WorkspaceEdit();
    const result: RenameResult = {
      succeeded: 0,
      failed: [],
      skipped: 0,
    };

    // Add all rename operations to the workspace edit
    logger.info(`Adding ${operations.length} operations to workspace edit`);
    for (const op of operations) {
      workspaceEdit.renameFile(op.fromUri, op.toUri, {
        overwrite: false,
        ignoreIfExists: false,
      });
    }

    // Apply the edit which becomes a single undo/redo step
    try {
      const success = await vscode.workspace.applyEdit(workspaceEdit);

      if (success) {
        logger.info(
          `Successfully applied workspace edit with ${operations.length} operations`,
        );
        result.succeeded = operations.length;

        // Update session file references after successful rename
        for (const op of operations) {
          this.sessionManager.updateSessionAfterRename(op.from, op.to);
        }
      } else {
        logger.error("Failed to apply workspace edit");
        // Consider all operations failed
        result.failed = operations.map((op) => ({
          path: op.from,
          error: "Workspace edit failed to apply",
        }));
      }
    } catch (error) {
      logger.error(`Error applying workspace edit: ${formatErrorValue(error)}`);
      // Consider all operations failed
      result.failed = operations.map((op) => ({
        path: op.from,
        error: error instanceof Error ? error.message : formatErrorValue(error),
      }));
    }

    return result;
  }
}
