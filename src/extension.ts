import * as vscode from "vscode";
import { UndoRedoHandler } from "./commands";
import { BatchRenameCommandHandler } from "./commands/batchRenameCommand";
import { extensionContext } from "./utils/extension-context";
import { logger } from "./utils/logger";

export function activate(context: vscode.ExtensionContext): void {
  try {
    // Initialize extension context manager (type-safe)
    extensionContext.initialize(context);

    // For backward compatibility with existing code
    global.__batchRenameContext = context;

    const extensionPackage = context.extension.packageJSON as {
      version: string;
    };

    logger.info(
      `Batch Rename extension activating. Version: ${extensionPackage.version}`,
    );

    // Register the batch rename command
    const batchRenameCommand = new BatchRenameCommandHandler(context);
    const batchRenameDisposable = batchRenameCommand.register();

    // Register undo/redo handler
    const undoRedoHandler = new UndoRedoHandler();
    const undoRedoDisposables = undoRedoHandler.register();

    // Add all disposables to subscriptions
    context.subscriptions.push(batchRenameDisposable, ...undoRedoDisposables);

    // Use proper void return for async operations that don't use the result
    const undoListener = vscode.workspace.onDidChangeTextDocument(async (e) => {
      if (
        e.contentChanges.length > 0 &&
        e.reason === vscode.TextDocumentChangeReason.Undo
      ) {
        logger.debug(`Undo operation detected`);

        // Type-safe context access
        const lastAnchorUri = extensionContext.getWorkspaceState<string>(
          "batchRename.lastAnchorUri",
        );
        if (lastAnchorUri) {
          logger.debug(`Found potential batch rename anchor: ${lastAnchorUri}`);

          try {
            // If the last renamed file exists, ensure it's visible for proper undo tracking
            const uri = vscode.Uri.parse(lastAnchorUri);
            const doc = await vscode.workspace.openTextDocument(uri);

            // Check if it's already open
            if (
              !vscode.window.visibleTextEditors.some(
                (e) => e.document.uri.toString() === lastAnchorUri,
              )
            ) {
              // Ignore return value when we don't need it
              await vscode.window.showTextDocument(doc, {
                preview: true,
                preserveFocus: true,
                viewColumn: vscode.ViewColumn.Beside,
              });

              // Close it after a brief delay
              setTimeout(() => {
                vscode.commands.executeCommand(
                  "workbench.action.closeActiveEditor",
                );
              }, 300);
            }
          } catch (error) {
            // File might not exist anymore, which is expected after an undo
            logger.debug(
              `Could not open anchor file: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
    });

    // Add all listeners and commands to subscriptions
    context.subscriptions.push(undoListener);

    logger.info("Batch Rename extension activated successfully");
  } catch (error) {
    logger.error(
      `Error during extension activation: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

export function deactivate(): void {
  // Clean up global context
  global.__batchRenameContext = undefined;
  logger.debug("Batch Rename extension deactivated");
}
