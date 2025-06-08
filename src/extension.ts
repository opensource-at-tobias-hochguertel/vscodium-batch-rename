// src/extension.ts
import * as vscode from "vscode";
import { BatchRenameCommandHandler } from "./commands";
import { ExtensionPackage } from "./types";
import { logger } from "./utils";
import { formatErrorValue } from "./utils/formatters";

/**
 * Activate the extension
 */
export function activate(context: vscode.ExtensionContext): void {
  // Type assertion with specific interface
  const extensionPackage = context.extension.packageJSON as ExtensionPackage;

  logger.info(
    `Batch Rename extension activating. Version: ${extensionPackage.version}`,
  );

  try {
    // Register the batch rename command
    const batchRenameCommand = new BatchRenameCommandHandler(context);
    const disposable = batchRenameCommand.register();

    // Add command to subscriptions
    context.subscriptions.push(disposable);

    logger.info("Batch Rename extension activated successfully");
  } catch (error) {
    logger.error(
      `Error during extension activation: ${formatErrorValue(error)}`,
    );
    throw error;
  }
}

/**
 * Deactivate the extension
 */
export function deactivate(): void {
  logger.info("Batch Rename extension deactivating");
  logger.dispose();
}
