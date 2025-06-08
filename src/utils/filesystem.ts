// src/utils/filesystem.ts
import * as fs from "fs/promises";
import * as path from "path";
import { formatErrorValue } from "./formatters";
import { logger } from "./logger";

/**
 * Check if a file exists at the given path
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a directory if it doesn't exist
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    logger.debug(`Directory ensured: ${dirPath}`);
  } catch (error) {
    logger.warn(
      `Could not create directory ${dirPath}: ${formatErrorValue(error)}`,
    );
    // Non-critical error, directory might already exist
  }
}

/**
 * Delete a file if it exists
 */
export async function deleteFileIfExists(filePath: string): Promise<boolean> {
  try {
    if (await fileExists(filePath)) {
      await fs.unlink(filePath);
      logger.debug(`Deleted file: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(
      `Failed to delete file ${filePath}: ${formatErrorValue(error)}`,
    );
    return false;
  }
}

/**
 * Write content to a file
 */
export async function writeFile(
  filePath: string,
  content: string,
): Promise<void> {
  try {
    await fs.writeFile(filePath, content, "utf8");
    logger.debug(`Wrote file: ${filePath}`);
  } catch (error) {
    logger.error(
      `Failed to write file ${filePath}: ${formatErrorValue(error)}`,
    );
    throw new Error(`Failed to write file: ${formatErrorValue(error)}`);
  }
}

/**
 * Validate a filename (no path separators)
 */
export function validateFileName(fileName: string): boolean {
  return !fileName.includes("/") && !fileName.includes("\\");
}

/**
 * Get a unique filename if the target path already exists
 */
export async function getUniqueFilePath(filePath: string): Promise<string> {
  if (!(await fileExists(filePath))) {
    return filePath;
  }

  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const dir = path.dirname(filePath);
  let num = 1;
  let newPath = filePath;

  while (await fileExists(newPath)) {
    newPath = path.join(dir, `${baseName}_${num}${ext}`);
    num++;
  }

  return newPath;
}
