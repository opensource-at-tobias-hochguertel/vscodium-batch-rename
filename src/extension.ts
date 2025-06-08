import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Represents a file to be renamed with its path components
 */
interface RenameFile {
    fsPath: string;
    basename: string;
    basepath: string;
}

/**
 * Represents an active renaming session
 */
interface RenamingSession {
    files: RenameFile[];
    document?: vscode.TextDocument;
    tempFilePath: string;
}

/**
 * Represents a rename operation
 */
interface RenameOperation {
    from: string;
    to: string;
}

export function activate(context: vscode.ExtensionContext): void {
    let currentRenamingSession: RenamingSession | undefined;

    // Register the command that is provided to the user
    const disposableRenameCommand = vscode.commands.registerCommand(
        'extension.renameBatch',
        async (_clickedFile: unknown, selectedFiles: any[] | undefined) => {
            if (!selectedFiles?.length) {
                vscode.window.showErrorMessage('No files selected for batch rename.');
                return;
            }

            try {
                await startRenamingSession(selectedFiles);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Error starting batch rename: ${errorMessage}`);
            }
        }
    );

    /**
     * Initializes a new renaming session
     * @param selectedFiles Files selected for renaming
     */
    async function startRenamingSession(selectedFiles: any[]): Promise<void> {
        // Create temp file in extension's directory for better security
        const tempDir = path.join(context.extensionPath, 'temp');
        try {
            await fs.mkdir(tempDir, { recursive: true });
        } catch (error) {
            // Directory might already exist, which is fine
            console.log(`Note: Could not create temp directory: ${error}`);
        }

        const tempFilePath = path.join(tempDir, '.Batch Rename.txt');

        // Process files - safely validate input data
        const files: RenameFile[] = [];

        for (const file of selectedFiles) {
            if (!file?.fsPath) {
                throw new Error('Invalid file selection: Missing file path');
            }

            const basename = path.basename(file.fsPath);
            files.push({
                fsPath: file.fsPath,
                basename,
                basepath: file.fsPath.substring(0, file.fsPath.length - basename.length)
            });
        }

        if (files.length === 0) {
            throw new Error('No valid files found for renaming');
        }

        // Store the current renaming session
        currentRenamingSession = {
            files,
            tempFilePath
        };

        // Create temp file content (one filename per line)
        const content = files.map(file => file.basename).join('\n');

        try {
            await fs.writeFile(tempFilePath, content, 'utf8');
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(tempFilePath));

            // Check session still exists before updating it
            if (!currentRenamingSession) {
                throw new Error('Renaming session was unexpectedly cleared');
            }
            currentRenamingSession.document = document;

            await vscode.window.showTextDocument(document);

            // Show information message to guide the user
            vscode.window.showInformationMessage(
                'Edit filenames and save (Ctrl+S) to perform the batch rename operation'
            );
        } catch (error) {
            throw new Error(`Failed to create temporary file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // Save event handler
    const saveListener = vscode.workspace.onWillSaveTextDocument(async (event) => {
        if (!currentRenamingSession?.document ||
            event.document.uri.fsPath !== currentRenamingSession.document.uri.fsPath ||
            event.reason !== vscode.TextDocumentSaveReason.Manual) {
            return;
        }

        try {
            await performRenameOperation(event.document);
        } catch (error) {
            vscode.window.showErrorMessage(`Error during batch rename: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    /**
     * Performs the actual file renaming operations
     * @param document Document containing the new filenames
     */
    async function performRenameOperation(document: vscode.TextDocument): Promise<void> {
        const session = currentRenamingSession;
        if (!session) {
            vscode.window.showErrorMessage('Renaming session was unexpectedly cleared');
            return;
        }

        const newNames = document.getText().split(/[\r\n]+/).filter(Boolean);

        if (session.files.length !== newNames.length) {
            throw new Error(`The number of lines (${newNames.length}) does not match the number of selected files (${session.files.length}). Operation cancelled.`);
        }

        const operations: RenameOperation[] = [];

        // First pass - validate and prepare operations
        // Use safe iteration pattern to avoid undefined values
        for (let i = 0; i < Math.min(session.files.length, newNames.length); i++) {
            const file = session.files[i];
            const newName = newNames[i];

            // Both should be defined due to our length check, but TypeScript doesn't know that
            if (!file || !newName) {
                console.warn(`Skipping undefined file or name at index ${i}`);
                continue;
            }

            // Validate the new name
            if (newName.includes('/') || newName.includes('\\')) {
                throw new Error(`Invalid filename: "${newName}" contains path separators`);
            }

            const newPath = path.join(file.basepath, newName);

            // Skip if no change
            if (file.fsPath === newPath) continue;

            operations.push({ from: file.fsPath, to: newPath });
        }

        if (operations.length === 0) {
            vscode.window.showInformationMessage('No files to rename (names unchanged)');
            await cleanupRenamingSession();
            return;
        }

        // Show confirmation dialog
        const proceed = await vscode.window.showWarningMessage(
            `Are you sure you want to rename ${operations.length} files?`,
            { modal: true },
            'Yes', 'No'
        );

        if (proceed !== 'Yes') {
            return;
        }

        // Progress indicator
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Renaming files...",
            cancellable: false
        }, async (progress) => {
            const total = operations.length;
            const succeeded: string[] = [];
            const failed: { path: string; error: string }[] = [];

            // Second pass - perform renames
            for (const op of operations) {
                const currentIndex = operations.indexOf(op);

                progress.report({
                    message: `${currentIndex + 1}/${total}: ${path.basename(op.from)} → ${path.basename(op.to)}`,
                    increment: 100 / total
                });

                let newPath = op.to;
                let num = 1;

                // Handle filename conflicts
                try {
                    while (await fileExists(newPath)) {
                        const ext = path.extname(newPath);
                        const baseName = path.basename(newPath, ext);
                        const dir = path.dirname(newPath);
                        newPath = path.join(dir, `${baseName}_${num}${ext}`);
                        num++;
                    }

                    await fs.rename(op.from, newPath);
                    succeeded.push(path.basename(op.from));
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    failed.push({
                        path: op.from,
                        error: errorMsg
                    });
                    console.error(`Failed to rename "${op.from}": ${errorMsg}`);
                }
            }

            // Report results
            if (failed.length > 0) {
                vscode.window.showErrorMessage(`${succeeded.length} files renamed, ${failed.length} failed. See output for details.`);

                // Output details to a channel
                const outputChannel = vscode.window.createOutputChannel('Batch Rename');
                outputChannel.appendLine(`---- Batch Rename Results (${new Date().toISOString()}) ----`);
                outputChannel.appendLine(`Successfully renamed: ${succeeded.length} files`);
                outputChannel.appendLine(`Failed: ${failed.length} files\n`);

                if (failed.length > 0) {
                    outputChannel.appendLine('ERRORS:');
                    failed.forEach(f => {
                        outputChannel.appendLine(`- "${path.basename(f.path)}": ${f.error}`);
                    });
                }

                outputChannel.show();
            } else {
                vscode.window.showInformationMessage(`Successfully renamed ${succeeded.length} files.`);
            }
        });

        // Cleanup
        await cleanupRenamingSession();
    }

    /**
     * Checks if a file exists at the given path
     */
    async function fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Cleans up temporary files and resources from the renaming session
     */
    async function cleanupRenamingSession(): Promise<void> {
        if (!currentRenamingSession) return;

        const tempFilePath = currentRenamingSession.tempFilePath;

        try {
            // Close the editor
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

            // Delete the temporary file
            try {
                if (await fileExists(tempFilePath)) {
                    await fs.unlink(tempFilePath);
                }
            } catch (error) {
                console.error('Failed to delete temporary file:', error);
                // Non-critical error, continue
            }
        } finally {
            // Always clear the current session
            currentRenamingSession = undefined;
        }
    }

    // Add the command and event listener to subscriptions
    context.subscriptions.push(
        disposableRenameCommand,
        saveListener
    );
}

// This method is called when extension is deactivated
export function deactivate(): void {
    // No cleanup needed as everything is handled through subscriptions
}
