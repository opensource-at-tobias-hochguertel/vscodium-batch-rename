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

        // Mark as succeeded first - the anchoring should be considered an enhancement
        // not a requirement for success
        result.succeeded = operations.length;

        // Update session file references
        for (const op of operations) {
          this.sessionManager.updateSessionAfterRename(op.from, op.to);
        }

        // Store rename metadata for undo tracking
        const lastOp = operations[operations.length - 1];
        if (lastOp) {
          await extensionContext.storeWorkspaceState(
            "batchRename.lastAnchorUri",
            lastOp.toUri.toString(),
          );

          // Store all operation targets for better recovery options
          await extensionContext.storeWorkspaceState(
            "batchRename.targetUris",
            operations.map((op) => op.toUri.toString()),
          );
        }

        // Try to create editor anchors for undo/redo, but don't fail if this doesn't work
        try {
          await this.createUndoAnchor(operations);
        } catch (anchorError) {
          // Log but don't fail the operation - the files were already renamed successfully
          logger.warn(
            `Could not create undo anchor: ${formatErrorValue(anchorError)}`,
          );
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

  /**
   * Creates an editor anchor for undo/redo support with multiple fallback strategies
   * @param operations The rename operations that were performed
   */
  private async createUndoAnchor(operations: RenameOperation[]): Promise<void> {
    if (operations.length === 0) {
      return;
    }

    // Strategy 1: Check if any of the source files is already open in an editor
    const openEditors = vscode.window.visibleTextEditors;
    const openPaths = openEditors.map((editor) =>
      editor.document.uri.toString(),
    );
    const operationPaths = operations.map((op) => op.fromUri.toString());

    const isAnyFileOpen = operationPaths.some((path) =>
      openPaths.includes(path),
    );

    if (isAnyFileOpen) {
      logger.debug(
        "File(s) from operation already open in editor - using existing anchor",
      );
      return; // Already have an anchor, no need to create one
    }

    // Strategy 2: Try to open the destination files with delay for filesystem events to settle
    try {
      // Add a short delay to allow file system events to settle
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Try each destination file in sequence until one succeeds
      for (const op of operations) {
        try {
          logger.debug(`Attempting to open renamed file: ${op.toUri.fsPath}`);
          const document = await vscode.workspace.openTextDocument(op.toUri);

          await vscode.window.showTextDocument(document, {
            preview: true,
            preserveFocus: true,
            viewColumn: vscode.ViewColumn.Beside,
          });

          logger.debug(
            `Successfully created undo anchor with: ${op.toUri.fsPath}`,
          );

          // Close the editor after a short delay to avoid cluttering the UI
          setTimeout((): void => {
            void vscode.commands.executeCommand(
              "workbench.action.closeActiveEditor",
            );
            logger.debug("Closed temporary anchor editor");
          }, 500);

          return; // Successfully created an anchor
        } catch (error) {
          logger.debug(
            `Could not open ${op.toUri.fsPath}: ${formatErrorValue(error)}`,
          );
          logger.debug(`Continuing to next file`);
          // Continue to next file
        }
      }

      // Strategy 3: Try with original files as fallback (they might still be accessible)
      for (const op of operations) {
        try {
          logger.debug(
            `Attempting to open original file: ${op.fromUri.fsPath}`,
          );
          const document = await vscode.workspace.openTextDocument(op.fromUri);

          await vscode.window.showTextDocument(document, {
            preview: true,
            preserveFocus: true,
            viewColumn: vscode.ViewColumn.Beside,
          });

          logger.debug(
            `Created undo anchor with original file: ${op.fromUri.fsPath}`,
          );

          setTimeout((): void => {
            void vscode.commands.executeCommand(
              "workbench.action.closeActiveEditor",
            );
            logger.debug("Closed temporary anchor editor");
          }, 500);

          return; // Successfully created an anchor
        } catch (error) {
          logger.debug(
            `Could not open ${op.fromUri.fsPath}: ${formatErrorValue(error)}`,
          );
          logger.debug(`Continuing to next file`);
          // Continue to next file
        }
      }

      // Strategy 4: Create a virtual document as last resort
      logger.debug("Creating virtual document as undo anchor");
      const timestamp = new Date().toISOString();
      const content = [
        "// Temporary anchor for batch rename operation",
        `// ${timestamp}`,
        "// This document helps VSCode track undo/redo operations",
        "// and will close automatically.",
        "",
        "/* Renamed files:",
        ...operations.map(
          (op) => ` * ${path.basename(op.from)} → ${path.basename(op.to)}`,
        ),
        " */",
      ].join("\n");

      const doc = await vscode.workspace.openTextDocument({
        content,
        language: "javascript",
      });
      await vscode.window.showTextDocument(doc, { preview: true });

      setTimeout((): void => {
        void vscode.commands.executeCommand(
          "workbench.action.closeActiveEditor",
        );
        logger.debug("Closed virtual document anchor editor");
      }, 800);
    } catch (error) {
      // This is a progressive enhancement, so we log but don't throw
      logger.warn(
        `Failed to create any editor anchor: ${formatErrorValue(error)}`,
      );
    }
  }
}
