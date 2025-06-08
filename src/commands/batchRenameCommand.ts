// src/commands/batchRenameCommand.ts
import path from "path";
import * as vscode from "vscode";
import { BatchRenamer } from "../core/renamer";
import { SessionManager } from "../core/session";
import { RenameOperation, RenameRequest } from "../types";
import { logger } from "../utils/logger";

/**
 * Handler for the batch rename command
 */
export class BatchRenameCommandHandler {
  private readonly sessionManager: SessionManager;
  private readonly renamer: BatchRenamer;
  private readonly context: vscode.ExtensionContext;

  /**
   * Create a new batch rename command handler
   */
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.sessionManager = new SessionManager(context.extensionPath);
    this.renamer = new BatchRenamer();

    // Register the save handler
    this.registerSaveHandler();
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
        error instanceof Error ? error.message : String(error);
      logger.error(`Error starting batch rename: ${errorMessage}`);
      vscode.window.showErrorMessage(
        `Error starting batch rename: ${errorMessage}`,
      );
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
          await this.performRename(event.document);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error(`Error during batch rename: ${errorMessage}`);
          vscode.window.showErrorMessage(
            `Error during batch rename: ${errorMessage}`,
          );
        }
      },
    );

    // Add the save listener to the context
    this.context.subscriptions.push(saveListener);
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

      if (session.files.length !== newNames.length) {
        throw new Error(
          `The number of lines (${newNames.length}) does not match the number of selected files (${session.files.length}). Operation cancelled.`,
        );
      }

      // Create rename requests - pairing files with their new names
      const renameRequests: RenameRequest[] = session.files
        .map((file, index) => {
          const newName = newNames[index];
          // Only create valid requests where newName is defined
          return newName !== undefined ? { file, newName } : null;
        })
        .filter((request): request is RenameRequest => request !== null);

      // Validate we still have the expected number of requests
      if (renameRequests.length !== session.files.length) {
        logger.error(
          `Expected ${session.files.length} rename requests but got ${renameRequests.length}`,
        );
        throw new Error(
          `Some filenames could not be properly mapped. Operation cancelled.`,
        );
      }

      // Validate operations
      let operations: RenameOperation[];
      try {
        operations =
          await this.renamer.validateRenameOperations(renameRequests);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(`Validation error: ${errorMessage}`);
        vscode.window.showErrorMessage(`Validation error: ${errorMessage}`);
        return;
      }

      if (operations.length === 0) {
        logger.info("No files to rename (names unchanged)");
        vscode.window.showInformationMessage(
          "No files to rename (names unchanged)",
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
        },
      );

      // Cleanup
      await this.sessionManager.clearSession();
    } catch (error) {
      throw new Error(
        `Error processing rename: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
