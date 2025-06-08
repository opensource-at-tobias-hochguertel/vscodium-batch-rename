// src/core/session.ts
import * as path from "path";
import * as vscode from "vscode";
import { RenameFile, RenamingSession } from "../types";
import {
  deleteFileIfExists,
  ensureDirectory,
  writeFile,
} from "../utils/filesystem";
import { logger } from "../utils/logger";
import { formatErrorValue } from "../utils/formatters";

/**
 * Manages renaming sessions
 */
export class SessionManager {
  private currentSession?: RenamingSession;
  private readonly extensionPath: string;

  /**
   * Create a new session manager
   */
  constructor(extensionPath: string) {
    this.extensionPath = extensionPath;
  }

  /**
   * Get the current session
   */
  public getCurrentSession(): RenamingSession | undefined {
    return this.currentSession;
  }

  /**
   * Create and initialize a new renaming session
   */
  public async createSession(
    selectedFiles: vscode.Uri[],
  ): Promise<RenamingSession> {
    // Clear any existing session
    await this.clearSession();

    // Create temp directory
    const tempDir = path.join(this.extensionPath, "temp");
    await ensureDirectory(tempDir);

    const tempFilePath = path.join(tempDir, ".Batch Rename.txt");

    // Process files
    const files: RenameFile[] = selectedFiles.map((uri) => {
      const fsPath = uri.fsPath;
      const basename = path.basename(fsPath);
      return {
        fsPath,
        basename,
        basepath: fsPath.substring(0, fsPath.length - basename.length),
        uri,
      };
    });

    if (files.length === 0) {
      throw new Error("No valid files found for renaming");
    }

    // Create and store session
    this.currentSession = {
      files,
      tempFilePath,
    };

    logger.info(`Created session with ${files.length} files`);
    return this.currentSession;
  }

  /**
   * Initialize the temp file and open it in the editor
   */
  public async openSessionEditor(
    session: RenamingSession,
  ): Promise<vscode.TextDocument> {
    // Create temp file content (one filename per line)
    const content = session.files.map((file) => file.basename).join("\n");

    try {
      await writeFile(session.tempFilePath, content);
      const document = await vscode.workspace.openTextDocument(
        vscode.Uri.file(session.tempFilePath),
      );

      // Check session still exists before updating it
      if (this.currentSession !== session) {
        throw new Error("Renaming session was unexpectedly cleared");
      }

      this.currentSession.document = document;

      // Open the document
      await vscode.window.showTextDocument(document);

      // Add helpful instruction comment
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === document) {
        await editor.edit((editBuilder) => {
          editBuilder.insert(
            new vscode.Position(0, 0),
            "// Edit filenames below (one per line) and save (Ctrl+S) to apply changes\n" +
              "// Press Escape to cancel\n\n",
          );
        });

        // Move cursor to the first filename
        const firstNamePos = new vscode.Position(3, 0);
        editor.selection = new vscode.Selection(firstNamePos, firstNamePos);
      }

      logger.info("Opened session editor");
      return document;
    } catch (error) {
      throw new Error(
        `Failed to create temporary file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Extract new filenames from the document
   */
  public getNewFilenamesFromDocument(document: vscode.TextDocument): string[] {
    return document
      .getText()
      .split(/[\r\n]+/)
      .filter(
        (line) => !line.trim().startsWith("//") && line.trim().length > 0,
      );
  }

  /**
   * Clear the current session and clean up resources
   */
  public async clearSession(): Promise<void> {
    if (!this.currentSession) return;

    logger.debug("Cleaning up session");

    const tempFilePath = this.currentSession.tempFilePath;

    try {
      // Close the editor
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor",
      );

      // Delete the temporary file
      await deleteFileIfExists(tempFilePath);
    } catch (error) {
      logger.error(`Error during session cleanup: ${formatErrorValue(error)}`);
      // Non-critical error, continue
    } finally {
      // Always clear the current session
      this.currentSession = undefined;
      logger.debug("Session cleared");
    }
  }
}
