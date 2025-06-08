// src/commands/batchRenameCommand.ts
import * as path from "path";
import * as vscode from "vscode";
import { BatchRenamer } from "../core/renamer";
import { SessionManager } from "../core/session";
import { RenameFile, RenameOperation, RenameRequest } from "../types";
import { formatErrorValue } from "../utils/formatters";
import { logger } from "../utils/logger";

/**
 * Handler for the batch rename command
 */
export class BatchRenameCommandHandler {
  private readonly sessionManager: SessionManager;
  private readonly renamer: BatchRenamer;
  private readonly context: vscode.ExtensionContext;
  private isProcessingRename: boolean = false;

  /**
   * Create a new batch rename command handler
   */
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.sessionManager = new SessionManager(context.extensionPath);
    this.renamer = new BatchRenamer(this.sessionManager);

    // Register the save handler
    this.registerSaveHandler();

    // Register the close handler
    this.registerCloseHandler();
  }

  /**
   * Register the command with VSCode
   */
  public register(): vscode.Disposable {
    return vscode.commands.registerCommand(
      "extension.renameBatch",
      this.execute.bind(this),
    );
  }

  /**
   * Execute the batch rename command
   */
  private async execute(
    _clickedFile: unknown,
    selectedFiles: vscode.Uri[] | undefined,
  ): Promise<void> {
    if (!selectedFiles?.length) {
      vscode.window.showErrorMessage("No files selected for batch rename.");
      return;
    }

    try {
      logger.info(`Starting batch rename with ${selectedFiles.length} files`);

      // Create a new session
      const session = await this.sessionManager.createSession(selectedFiles);

      // Open the editor
      await this.sessionManager.openSessionEditor(session);

      // Show information message
      vscode.window.showInformationMessage(
        "Edit filenames and save (Ctrl+S) to perform the batch rename operation",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : formatErrorValue(error);
      logger.error(`Error starting batch rename: ${errorMessage}`);
      vscode.window.showErrorMessage(
        `Error starting batch rename: ${errorMessage}`,
      );

      // Make sure to clean up if an error occurs
      await this.sessionManager.clearSession();
    }
  }

  /**
   * Register the save handler to detect when the user saves the rename document
   */
  private registerSaveHandler(): void {
    const saveListener = vscode.workspace.onWillSaveTextDocument(
      async (event) => {
        const session = this.sessionManager.getCurrentSession();

        if (
          !session?.document ||
          event.document.uri.fsPath !== session.document.uri.fsPath ||
          event.reason !== vscode.TextDocumentSaveReason.Manual
        ) {
          return;
        }

        try {
          // Prevent concurrent rename operations
          if (this.isProcessingRename) {
            logger.warn("Ignoring save while rename is in progress");
            // Cancel the save operation to prevent file contention
            event.waitUntil(
              Promise.reject(new Error("Rename already in progress")),
            );
            return;
          }

          this.isProcessingRename = true;

          // Verify all files still exist before proceeding
          if (!(await this.sessionManager.verifySessionFiles())) {
            throw new Error(
              "Some files in the session no longer exist. Reopen the rename dialog to continue.",
            );
          }

          await this.performRename(event.document);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : formatErrorValue(error);
          logger.error(`Error during batch rename: ${errorMessage}`);
          vscode.window.showErrorMessage(
            `Error during batch rename: ${errorMessage}`,
          );

          // Cancel the save operation to prevent further issues
          event.waitUntil(Promise.reject(new Error("Rename operation failed")));
        } finally {
          this.isProcessingRename = false;
        }
      },
    );

    // Add the save listener to the context
    this.context.subscriptions.push(saveListener);
  }

  /**
   * Register handler for when an editor is closed
   */
  private registerCloseHandler(): void {
    const closeListener = vscode.window.onDidChangeVisibleTextEditors(
      async (editors) => {
        const session = this.sessionManager.getCurrentSession();

        // Early return if no active session or document
        if (!session || !session.document) {
          return;
        }

        // Check if our temp document is still open
        const tempEditorStillOpen = editors.some((editor) => {
          if (!session || !session.document) {
            return false;
          }
          return editor.document.uri.fsPath === session.document.uri.fsPath;
        });

        if (!tempEditorStillOpen && !this.isProcessingRename) {
          logger.debug("Temp file editor was closed, cleaning up session");
          await this.sessionManager.clearSession();
        }
      },
    );

    this.context.subscriptions.push(closeListener);
  }

  /**
   * Create type-safe rename requests with definite newNames
   */
  private createRenameRequests(
    files: RenameFile[],
    newNames: string[],
  ): RenameRequest[] {
    // Create rename requests - pairing files with their new names
    return files
      .map((file, index): RenameRequest | null => {
        const newName = newNames[index];
        // Skip entries with undefined or empty newNames
        return newName !== undefined && newName.trim() !== ""
          ? { file, newName }
          : null;
      })
      .filter((request): request is RenameRequest => request !== null);
  }

  /**
   * Perform the rename operation when the document is saved
   */
  private async performRename(document: vscode.TextDocument): Promise<void> {
    const session = this.sessionManager.getCurrentSession();
    if (!session) {
      logger.error("Renaming session was unexpectedly cleared");
      vscode.window.showErrorMessage(
        "Renaming session was unexpectedly cleared",
      );
      return;
    }

    try {
      // Get new names from document
      const newNames =
        this.sessionManager.getNewFilenamesFromDocument(document);

      if (newNames.length === 0) {
        logger.info("No valid filenames found in document");
        vscode.window.showInformationMessage(
          "No valid filenames found. Operation cancelled.",
        );
        return;
      }

      if (session.files.length !== newNames.length) {
        throw new Error(
          `The number of lines (${newNames.length}) does not match the number of selected files (${session.files.length}). Operation cancelled.`,
        );
      }

      // Create type-safe rename requests
      const renameRequests = this.createRenameRequests(session.files, newNames);

      // Validate the number of requests matches expected count
      if (renameRequests.length !== session.files.length) {
        logger.warn(
          `Expected ${session.files.length} rename requests but got ${renameRequests.length}`,
        );
        throw new Error(
          "Some filenames could not be properly mapped. Operation cancelled.",
        );
      }

      // Validate operations
      let operations: RenameOperation[];
      try {
        operations =
          await this.renamer.validateRenameOperations(renameRequests);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : formatErrorValue(error);
        logger.error(`Validation error: ${errorMessage}`);
        vscode.window.showErrorMessage(`Validation error: ${errorMessage}`);
        return;
      }

      if (operations.length === 0) {
        logger.info("No files to rename (names unchanged or invalid)");
        vscode.window.showInformationMessage(
          "No files to rename (names unchanged or invalid)",
        );
        await this.sessionManager.clearSession();
        return;
      }

      // Show confirmation dialog
      const proceed = await vscode.window.showWarningMessage(
        `Are you sure you want to rename ${operations.length} files?`,
        { modal: true },
        "Yes",
        "No",
      );

      if (proceed !== "Yes") {
        logger.info("User cancelled rename operation");
        return;
      }

      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Renaming files...",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ increment: 0 });

          // Perform rename with workspace edit for undo support
          const result = await this.renamer.renameWithWorkspaceEdit(operations);

          // Report results
          if (result.failed.length > 0) {
            logger.warn(
              `${result.succeeded} files renamed, ${result.failed.length} failed`,
            );
            vscode.window.showErrorMessage(
              `${result.succeeded} files renamed, ${result.failed.length} failed. See output for details.`,
            );

            // Output details to logger
            logger.info(`---- Batch Rename Results ----`);
            logger.info(`Successfully renamed: ${result.succeeded} files`);
            logger.info(`Failed: ${result.failed.length} files`);

            if (result.failed.length > 0) {
              logger.info("ERRORS:");
              result.failed.forEach((f) => {
                logger.info(`- "${path.basename(f.path)}": ${f.error}`);
              });
            }

            logger.show();
          } else {
            logger.info(`Successfully renamed ${result.succeeded} files`);
            vscode.window.showInformationMessage(
              `Successfully renamed ${result.succeeded} files.`,
            );
          }

          progress.report({ increment: 100 });

          // Clean up session after successful rename
          if (result.succeeded > 0) {
            await this.sessionManager.clearSession();
          }
        },
      );
    } catch (error) {
      throw new Error(`Error processing rename: ${formatErrorValue(error)}`);
    }
  }
}
