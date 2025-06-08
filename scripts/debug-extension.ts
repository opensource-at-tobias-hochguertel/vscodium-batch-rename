#!/usr/bin/env bun
// scripts/debug-extension.ts

/**
 * VSCode Extension Debug Helper
 *
 * Launches VSCode with the extension loaded and playground directory opened
 * for efficient manual testing.
 *
 * Environment variables:
 * - `IDE`: The path to the IDE to launch (default: `code`)
 *
 * This script will:
 * 1. Verify the project structure and compilation status
 * 2. Create a workspace file for VSCode (if it doesn't exist [default: `./playground.code-workspace`])
 * 3. Launch VSCode with the extension loaded ([default: `${process.env['IDE'] || 'code'}`, `${workspaceFilePath}`, `--new-window`, `--disable-extensions`, `--extensionDevelopmentPath=${projectRoot}`])
 *
 * Usage:
 * - `bun run dev` - Launch VSCode with the extension loaded
 * - `bun run dev:verbose` - Launch VSCode with verbose logging
 *
 * Note: This script will automatically compile the extension if needed.
 *
 * Required commands from package.json:
 * - `bun scripts/create-playground.ts` - Creates a playground directory (if it doesn't exist [default: `./playground`])
 * - `yarn compile` - Compiles the extension (if the output directory is missing [default: `./out`])
 */

import chalk from 'chalk';
import { existsSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

// Configuration
const projectRoot = resolve(import.meta.dir, '..');
const playgroundPath = join(projectRoot, 'playground');
const workspaceFilePath = join(projectRoot, 'playground.code-workspace');

// Logger setup for consistent output
const logger = {
  info: (message: string) => console.log(chalk.blue(`ℹ️ ${message}`)),
  success: (message: string) => console.log(chalk.green(`✅ ${message}`)),
  warn: (message: string) => console.log(chalk.yellow(`⚠️ ${message}`)),
  error: (message: string) => console.log(chalk.red(`❌ ${message}`))
};

/**
 * Verify the project structure and compilation status
 */
async function verifyProjectSetup(): Promise<void> {
  // Check if package.json exists
  const packagePath = join(projectRoot, 'package.json');
  if (existsSync(packagePath)) {
    logger.success(`Found package.json at: ${packagePath}`);
    const pkg = JSON.parse(await Bun.file(packagePath).text());
    logger.info(`Extension name: ${pkg.name}`);
  } else {
    logger.error(`package.json not found at: ${packagePath}`);
    process.exit(1);
  }

  // Check for output directory
  const outDir = join(projectRoot, 'out');
  if (existsSync(outDir)) {
    logger.success(`Output directory found at: ${outDir}`);
  } else {
    logger.warn(`Output directory not found at: ${outDir}. Extension may not be compiled.`);
    logger.info(`Running compilation...`);

    try {
      // Auto-compile if output directory doesn't exist
      const proc = Bun.spawnSync(['yarn', 'compile'], {
        cwd: projectRoot,
        stderr: 'pipe',
        stdout: 'pipe'
      });

      if (proc.exitCode === 0) {
        logger.success(`Compilation successful`);
      } else {
        logger.error(`Compilation failed: ${proc.stderr.toString()}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Failed to compile: ${error}`);
      process.exit(1);
    }
  }

  // Check for playground directory
  if (!existsSync(playgroundPath)) {
    logger.warn(`Playground directory not found at: ${playgroundPath}`);
    logger.info(`Creating playground directory...`);

    try {
      // Auto-create playground if it doesn't exist
      const proc = Bun.spawnSync(['./scripts/create-playground.ts'], {
        cwd: projectRoot,
        stderr: 'pipe',
        stdout: 'pipe'
      });

      if (proc.exitCode === 0) {
        logger.success(`Playground created successfully`);
      } else {
        logger.error(`Failed to create playground: ${proc.stderr.toString()}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Failed to create playground: ${error}`);
      process.exit(1);
    }
  } else {
    logger.success(`Playground directory found at: ${playgroundPath}`);
  }
}

/**
 * Create a workspace file that VSCode will use to load the playground
 */
function createWorkspaceFile(): void {
  // Create a workspace file for more reliable loading
  const workspaceContent = {
    folders: [{ path: playgroundPath }],
    settings: {
      // Optional: Add workspace-specific settings here
      'editor.formatOnSave': true
    }
  };

  try {
    writeFileSync(workspaceFilePath, JSON.stringify(workspaceContent, null, 2));
    logger.success(`Created workspace file at: ${workspaceFilePath}`);
  } catch (error) {
    logger.error(`Failed to create workspace file: ${error}`);
    process.exit(1);
  }
}

/**
 * Launch VSCode with extension development path and playground workspace
 */
function launchVSCode(): void {
  logger.info(`Launching VSCode with extension development path: ${projectRoot}`);
  logger.info(`Opening playground workspace: ${workspaceFilePath}`);

  // The command to launch VSCode - workspace file first, then flags
  const cmd = [
    `${process.env['IDE'] || 'code'}`,
    `${workspaceFilePath}`,           // First argument should be the workspace file
    '--new-window',              // Force new window
    '--disable-extensions',      // Disable other extensions to avoid conflicts
    `--extensionDevelopmentPath=${projectRoot}`  // Load our extension
  ];

  // Add verbose logging if requested
  if (process.argv.includes('--verbose')) {
    cmd.push('--verbose');
  }

  logger.info(`Launching with command: ${cmd.join(' ')}`);

  // Important: Do NOT use Bun.spawnSync here as it will block until VSCode exits
  // Instead, use Bun.spawn and let it run independently
  const proc = Bun.spawn({
    cmd,
    stdio: ['inherit', 'inherit', 'inherit'],
    onExit(_proc, _exitCode, _signalCode, error) {
      if (error) {
        logger.error(`VSCode process error: ${error}`);
      }

      // Do NOT delete the workspace file here - VSCode may still be using it
      // The file is small and temporary, so it's better to leave it
    }
  });

  // Don't wait for VSCode to exit - let it run independently
  proc.unref();

  logger.success(`VSCode process launched with PID: ${proc.pid}`);
  logger.info(`Note: The workspace file at ${workspaceFilePath} will remain for future sessions.`);
  logger.info(`      You can delete it manually if no longer needed.`);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  logger.info(`Starting extension debug session at ${new Date().toISOString()}`);

  // Verify project structure
  await verifyProjectSetup();

  // Create workspace file (if it doesn't exist or needs updating)
  createWorkspaceFile();

  // Launch VSCode
  launchVSCode();

  logger.info(`Debug session initialized. VSCode should open momentarily.`);
  logger.info(`Test workflow:`);
  logger.info(`1. Select multiple files in the playground`);
  logger.info(`2. Right-click and select "Batch Rename"`);
  logger.info(`3. Edit the names in the editor and save to apply changes`);
}

// Run the script
await main();
