// src/core/renamer.ts
import * as path from "path";
import * as vscode from "vscode";
import { RenameOperation, RenameRequest, RenameResult } from "../types";
import { extensionContext } from "../utils/extension-context";
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
   * Performs batch renaming with improved undo/redo support by anchoring
   * operations to an editor context
   */
  public async renameWithWorkspaceEdit(
    operations: RenameOperation[],
  ): Promise<RenameResult> {
    // Early return for empty operations
    if (operations.length === 0) {
      return { succeeded: 0, failed: [], skipped: 0 };
    }

    logger.debug(`Creating workspace edit for ${operations.length} operations`);
    const workspaceEdit = new vscode.WorkspaceEdit();
    const result: RenameResult = {
      succeeded: 0,
      failed: [],
      skipped: 0,
    };

    try {
      // Get the first and last operations with explicit checking
      const firstOp = operations[0];
      const lastOp = operations[operations.length - 1];

      if (!firstOp || !lastOp) {
        logger.error("Invalid operation array structure");
        return {
          succeeded: 0,
          failed: operations.map((op) => ({
            path: op?.from || "unknown",
            error: "Invalid operation structure",
          })),
          skipped: 0,
        };
      }

      const firstOpSource = firstOp.fromUri;
      const lastOpTarget = lastOp.toUri;
      let anchorDocument: vscode.TextDocument | undefined;

      // First, check if any of the files is already open in an editor
      const openEditors = vscode.window.visibleTextEditors;
      const openPaths = openEditors.map((editor) =>
        editor.document.uri.toString(),
      );
      const operationPaths = operations.map((op) => op.fromUri.toString());

      const isAnyFileOpen = operationPaths.some((path) =>
        openPaths.includes(path),
      );

      if (!isAnyFileOpen) {
        // If no file is open, try to open one to anchor the undo stack
        logger.debug(
          "No files from operation are open in editors - creating anchor",
        );

        try {
          // Try to open a source file first
          if (await fileExists(firstOpSource.fsPath)) {
            anchorDocument =
              await vscode.workspace.openTextDocument(firstOpSource);
            logger.debug(
              `Created undo anchor with source file: ${firstOpSource.toString()}`,
            );
          }
        } catch (error) {
          logger.debug(
            `Could not open source file for undo anchoring: ${formatErrorValue(error)}`,
          );
        }
      } else {
        logger.debug(
          "File(s) from operation already open in editor - using existing anchor",
        );
      }

      // Add all rename operations to the workspace edit
      logger.info(`Adding ${operations.length} operations to workspace edit`);
      for (const op of operations) {
        workspaceEdit.renameFile(op.fromUri, op.toUri, {
          overwrite: false,
          ignoreIfExists: false,
        });
      }

      // Apply the edit which becomes a single undo/redo step
      const success = await vscode.workspace.applyEdit(workspaceEdit);

      if (success) {
        logger.info(
          `Successfully applied workspace edit with ${operations.length} operations`,
        );
        result.succeeded = operations.length;

        // Update session file references
        for (const op of operations) {
          this.sessionManager.updateSessionAfterRename(op.from, op.to);
        }

        // If we created an anchor document but didn't open it in an editor,
        // show it briefly to ensure VSCode tracks it for undo/redo, then close it
        if (
          anchorDocument &&
          !vscode.window.visibleTextEditors.some(
            (e) => e.document === anchorDocument,
          )
        ) {
          // Use type-safe context access
          await extensionContext.storeWorkspaceState(
            "batchRename.lastAnchorUri",
            lastOpTarget.toString(),
          );

          // Show document but ignore editor return value since we don't use it
          await vscode.window.showTextDocument(anchorDocument, {
            preview: true,
            preserveFocus: true,
            viewColumn: vscode.ViewColumn.Beside,
          });

          // Close the editor after a short delay (gives VSCode time to track it)
          if (
            anchorDocument &&
            !vscode.window.visibleTextEditors.some(
              (e) => e.document === anchorDocument,
            )
          ) {
            // Store anchor URI using context manager
            await extensionContext.storeWorkspaceState(
              "batchRename.lastAnchorUri",
              lastOp.toUri.toString(),
            );

            // Show document temporarily
            await vscode.window.showTextDocument(anchorDocument, {
              preview: true,
              preserveFocus: true,
              viewColumn: vscode.ViewColumn.Beside,
            });

            // Close editor after delay
            setTimeout((): void => {
              void vscode.commands.executeCommand(
                "workbench.action.closeActiveEditor",
              );
              logger.debug("Closed temporary anchor editor");
            }, 500);
          }

          // Close the editor after a short delay (gives VSCode time to track it)
          setTimeout(() => {
            // Use void operator to explicitly ignore the Promise
            void (async (): Promise<void> => {
              try {
                await vscode.commands.executeCommand(
                  "workbench.action.closeActiveEditor",
                );
                logger.debug(
                  `Closed temporary anchor editor: ${formatErrorValue(result)}`,
                );
              } catch (error) {
                logger.error(
                  `Error closing editor: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
            })();
          }, 500);
        }
      } else {
        logger.error("Failed to apply workspace edit");
        result.failed = operations.map((op) => ({
          path: op.from,
          error: "Workspace edit failed to apply",
        }));
      }
    } catch (error) {
      logger.error(`Error during rename operation: ${formatErrorValue(error)}`);
      return {
        succeeded: 0,
        failed: operations.map((op) => ({
          path: op?.from || "unknown",
          error: error instanceof Error ? error.message : String(error),
        })),
        skipped: 0,
      };
    }

    return result;
  }
}
