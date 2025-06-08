#!/usr/bin/env bun

/**
 * VSCode Extension Debug Helper
 *
 * Launches VSCode with the extension loaded and playground directory opened
 * for efficient manual testing.
 */

import chalk from 'chalk';
import { spawn } from 'child_process';
import fs from 'fs';
import { join, resolve } from 'path';

// Configuration
const projectRoot = resolve(import.meta.dir, '..');
const playgroundPath = join(projectRoot, 'playground');

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
function verifyProjectSetup(): void {
  // Check if package.json exists
  const packagePath = join(projectRoot, 'package.json');
  if (fs.existsSync(packagePath)) {
    logger.success(`Found package.json at: ${packagePath}`);
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    logger.info(`Extension name: ${pkg.name}`);
  } else {
    logger.error(`package.json not found at: ${packagePath}`);
    process.exit(1);
  }

  // Check for output directory
  const outDir = join(projectRoot, 'out');
  if (fs.existsSync(outDir)) {
    logger.success(`Output directory found at: ${outDir}`);
  } else {
    logger.warn(`Output directory not found at: ${outDir}. Extension may not be compiled.`);
    logger.info(`Running compilation...`);

    try {
      // Auto-compile if output directory doesn't exist
      const { stdout: _stdout, stderr, exitCode } = Bun.spawnSync<"pipe", "pipe">(['yarn', 'compile'], {
        cwd: projectRoot
      });

      if (exitCode === 0) {
        logger.success(`Compilation successful`);
      } else {
        logger.error(`Compilation failed: ${stderr.toString()}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Failed to compile: ${error}`);
      process.exit(1);
    }
  }

  // Check for playground directory
  if (!fs.existsSync(playgroundPath)) {
    logger.warn(`Playground directory not found at: ${playgroundPath}`);
    logger.info(`Creating playground directory...`);

    try {
      // Auto-create playground if it doesn't exist
      const { stdout: _stdout, stderr, exitCode } = Bun.spawnSync<"pipe", "pipe">(['./scripts/create-playground.ts'], {
        cwd: projectRoot
      });

      if (exitCode === 0) {
        logger.success(`Playground created successfully`);
      } else {
        logger.error(`Failed to create playground: ${stderr.toString()}`);
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
 * Launch VSCode with extension development path and playground workspace
 */
function launchVSCode(): void {
  // Create a workspace file for more reliable loading
  const workspaceFilePath = join(projectRoot, 'playground.code-workspace');
  const workspaceContent = {
    folders: [{ path: playgroundPath }],
    settings: {}
  };

  try {
    fs.writeFileSync(workspaceFilePath, JSON.stringify(workspaceContent, null, 2));
    logger.success(`Created temporary workspace file at: ${workspaceFilePath}`);
  } catch (error) {
    logger.error(`Failed to create workspace file: ${error}`);
    process.exit(1);
  }

  logger.info(`Launching VSCode with extension development path: ${projectRoot}`);
  logger.info(`Opening playground workspace: ${playgroundPath}`);

  // Arguments for VSCode - note the order is important
  const args = [
    workspaceFilePath,                     // First argument should be the workspace/folder
    '--new-window',                        // Force new window
    '--disable-extensions',                // Disable other extensions to avoid conflicts
    `--extensionDevelopmentPath=${projectRoot}`  // Load our extension
  ];

  // Add verbose logging if requested
  if (process.argv.includes('--verbose')) {
    args.push('--verbose');
  }

  logger.info(`Launching with command: code ${args.join(' ')}`);

  // Launch VSCode
  const child = spawn('code', args, {
    stdio: 'inherit',
    detached: false  // Don't detach, so we can see errors
  });

  // Handle process events
  child.on('error', (error) => {
    logger.error(`Failed to start VSCode: ${error.message}`);
    process.exit(1);
  });

  child.on('close', (code) => {
    if (code === 0) {
      logger.success(`VSCode launched successfully`);
    } else {
      logger.warn(`VSCode exited with code ${code}`);
    }

    // Clean up workspace file
    try {
      fs.unlinkSync(workspaceFilePath);
      logger.info(`Removed temporary workspace file`);
    } catch (error) {
      logger.warn(`Failed to clean up workspace file: ${error}`);
    }
  });
}

/**
 * Main function
 */
function main(): void {
  logger.info(`Starting extension debug session at ${new Date().toISOString()}`);

  // Verify project structure
  verifyProjectSetup();

  // Launch VSCode
  launchVSCode();

  logger.info(`Debug session initialized. VSCode should open momentarily.`);
  logger.info(`Test workflow:`);
  logger.info(`1. Select multiple files in the playground`);
  logger.info(`2. Right-click and select "Batch Rename"`);
  logger.info(`3. Edit the names in the editor and save to apply changes`);
}

// Run the script
main();
