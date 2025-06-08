// src/types/types.ts
import * as vscode from "vscode";

/**
 * Represents the extension package metadata
 */
export interface ExtensionPackage {
  version: string;
  name: string;
  // Add other fields as needed
}

/**
 * Represents a file to be renamed with its path components
 */
export interface RenameFile {
  /** Full file system path */
  fsPath: string;
  /** File name with extension */
  basename: string;
  /** Directory path with trailing separator */
  basepath: string;
  /** VSCode URI for the file */
  uri: vscode.Uri;
}

/**
 * Represents a request to rename a file
 */
export interface RenameRequest {
  /** The original file information */
  file: RenameFile;
  /** The new name for the file */
  newName: string;
}

/**
 * Represents an active renaming session
 */
export interface RenamingSession {
  /** Files selected for renaming */
  files: RenameFile[];
  /** Editor document containing new filenames */
  document?: vscode.TextDocument;
  /** Path to temporary file */
  tempFilePath: string;
}

/**
 * Represents a rename operation
 */
export interface RenameOperation {
  /** Original file path */
  from: string;
  /** New file path */
  to: string;
  /** Original file URI */
  fromUri: vscode.Uri;
  /** New file URI */
  toUri: vscode.Uri;
}

/**
 * Result of a rename operation
 */
export interface RenameResult {
  /** Number of successfully renamed files */
  succeeded: number;
  /** Failed operations with error details */
  failed: Array<{ path: string; error: string }>;
  /** Skipped operations (no changes) */
  skipped: number;
}

/**
 * Log levels for the logger
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}
