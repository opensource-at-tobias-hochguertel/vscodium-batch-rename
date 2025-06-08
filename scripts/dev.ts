#!/usr/bin/env bun
// scripts/dev.ts

/**
 * VSCode Extension Development Helper
 *
 * Provides utilities for developing and packaging the extension
 *
 * Environment variables:
 * - `IDE`: The path to the IDE to launch ([default: `code`])
 *
 * This script will:
 * - Compile the extension
 * - Launch VSCode with the extension loaded with the playground workspace opened ([default: `${process.env['IDE'] || 'code'}`, `${workspaceFilePath}`, `--new-window`, `--disable-extensions`, `--extensionDevelopmentPath=${projectRoot}`])
 *
 * Usage:
 * - `bun scripts/dev.ts` - Run the development utilities
 *
 * Common issues this script helps solve:
 *
 * Required commands from package.json:
 * - `yarn compile` - Compiles the extension
 * - `yarn watch` - Watches for changes and recompiles
 * - `yarn package` - Packages the extension
 * - `code` - Launches VSCode
 */

import chalk from 'chalk';
import { spawn } from 'child_process';
import path, { join } from 'path';

const ROOT_DIR = join(import.meta.dir, '..');

// Configure logger
const logger = {
  info: (message: string) => console.log(chalk.blue(`ℹ️ ${message}`)),
  success: (message: string) => console.log(chalk.green(`✅ ${message}`)),
  warn: (message: string) => console.log(chalk.yellow(`⚠️ ${message}`)),
  error: (message: string) => console.log(chalk.red(`❌ ${message}`))
};

// Execute a command with proper logging
async function exec(command: string, args: string[] = [], options: any = {}): Promise<number> {
  logger.info(`Running: ${command} ${args.join(' ')}`);

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: ROOT_DIR,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        logger.success(`Command completed successfully`);
      } else {
        logger.error(`Command failed with code ${code}`);
      }
      resolve(code || 0);
    });
  });
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'help';

const workspaceFilePath = path.join(ROOT_DIR, 'playground.code-workspace');

// Main function
async function main() {
  switch (command) {
    case 'compile':
      await exec('yarn', ['compile']);
      break;

    case 'watch':
      await exec('yarn', ['watch']);
      break;

    case 'package':
      logger.info('Building extension package...');
      await exec('yarn', ['compile']);
      await exec('vsce', ['package']);
      break;

    case 'launch':
      logger.info('Launching VSCode with extension...');
      await exec(
        `${process.env['IDE'] || 'code'}`,
        [
          `${workspaceFilePath}`,         // First argument should be the workspace file
          '--new-window',                 // Force new window
          '--disable-extensions',         // Disable other extensions to avoid conflicts
          `--extensionDevelopmentPath=${ROOT_DIR}`  // Load our extension
        ]
      );
      break;

    case 'help':
    default:
      console.log(`
VSCode Extension Development Helper

Usage:
  ./scripts/dev.ts [command]

Commands:
  compile     Compile the TypeScript code
  watch       Watch for changes and recompile
  package     Build and package the extension (.vsix)
  launch      Launch VSCode with the extension
  help        Show this help message
      `);
  }
}

main().catch(err => {
  logger.error(`Script error: ${err.message}`);
  process.exit(1);
});
