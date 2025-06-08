// src/core/session.ts
import * as path from "path";
import * as vscode from "vscode";
import { RenameFile, RenamingSession } from "../types";
import {
  deleteFileIfExists,
  ensureDirectory,
  fileExists,
  writeFile,
} from "../utils/filesystem";
import { logger } from "../utils/logger";

/**
 * Manages renaming sessions with improved state tracking
 */
export class SessionManager {
  private currentSession?: RenamingSession;
  private readonly extensionPath: string;
  private sessionLock: boolean = false;

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
    // Prevent concurrent session operations
    if (this.sessionLock) {
      throw new Error("A session operation is already in progress");
    }

    this.sessionLock = true;

    try {
      // Clear any existing session
      await this.clearSession();

      // Create temp directory
      const tempDir = path.join(this.extensionPath, "temp");
      await ensureDirectory(tempDir);

      // Generate a unique session ID to avoid conflicts
      const sessionId = Date.now().toString();
      const tempFilePath = path.join(tempDir, `.Batch Rename ${sessionId}.txt`);

      // Process files
      const files: RenameFile[] = [];

      // Validate files exist before adding to session
      for (const uri of selectedFiles) {
        const fsPath = uri.fsPath;

        if (await fileExists(fsPath)) {
          const basename = path.basename(fsPath);
          files.push({
            fsPath,
            basename,
            basepath: fsPath.substring(0, fsPath.length - basename.length),
            uri,
          });
        } else {
          logger.warn(`File not found, skipping: ${fsPath}`);
        }
      }

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
    } finally {
      this.sessionLock = false;
    }
  }

  /**
   * Update file references in the current session after rename
   * @param oldPath Original file path
   * @param newPath New file path
   */
  public updateSessionAfterRename(oldPath: string, newPath: string): void {
    if (!this.currentSession) {
      logger.warn(
        "Attempted to update session file references with no active session",
      );
      return;
    }

    const session = this.currentSession;

    // Find and update the renamed file in the session
    const fileIndex = session.files.findIndex(
      (file) => file.fsPath === oldPath,
    );

    if (fileIndex >= 0) {
      const newBasename = path.basename(newPath);
      const newUri = vscode.Uri.file(newPath);

      // Update file references
      session.files[fileIndex] = {
        fsPath: newPath,
        basename: newBasename,
        basepath: newPath.substring(0, newPath.length - newBasename.length),
        uri: newUri,
      };

      logger.debug(`Updated session file reference: ${oldPath} → ${newPath}`);
    } else {
      logger.warn(`Could not find file in session: ${oldPath}`);
    }
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create temporary file: ${errorMessage}`);
    }
  }

  /**
   * Extract new filenames from the document, handling comment lines
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
   * Verify all session files still exist
   * @returns True if all files exist, false otherwise
   */
  public async verifySessionFiles(): Promise<boolean> {
    if (!this.currentSession) return false;

    const nonExistentFiles: string[] = [];

    for (const file of this.currentSession.files) {
      if (!(await fileExists(file.fsPath))) {
        nonExistentFiles.push(file.fsPath);
      }
    }

    if (nonExistentFiles.length > 0) {
      logger.warn(
        `Some files in the session no longer exist: ${nonExistentFiles.join(", ")}`,
      );
      return false;
    }

    return true;
  }

  /**
   * Clear the current session and clean up resources
   */
  public async clearSession(): Promise<void> {
    if (!this.currentSession) return;

    logger.debug("Cleaning up session");

    const tempFilePath = this.currentSession.tempFilePath;

    try {
      // Try to close any editor with our temp file
      const editors = vscode.window.visibleTextEditors;
      const tempEditor = editors.find(
        (e) => e.document.uri.fsPath === tempFilePath,
      );

      if (tempEditor) {
        await vscode.commands.executeCommand(
          "workbench.action.closeActiveEditor",
        );
      }

      // Delete the temporary file
      await deleteFileIfExists(tempFilePath);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Error during session cleanup: ${errorMessage}`);
      // Non-critical error, continue
    } finally {
      // Always clear the current session
      this.currentSession = undefined;
      logger.debug("Session cleared");
    }
  }
}
