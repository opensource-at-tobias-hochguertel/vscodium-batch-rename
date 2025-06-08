// This is a declaration file - do not import it directly in runtime code
import * as vscode from "vscode";

// Extend the global namespace correctly
declare global {
  // Use var for compatibility with how globals work
  // This is one legitimate case where var is appropriate
  /* eslint-disable no-var */
  var __batchRenameContext: vscode.ExtensionContext | undefined;
  /* eslint-enable no-var */
}

// This export makes TypeScript treat this file as a module
export {};
