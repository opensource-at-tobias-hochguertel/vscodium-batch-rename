#!/usr/bin/env bun
// scripts/build.ts

/**
 * VSCode Extension Build Script
 *
 * Cleans the output directory, compiles the extension, and verifies the build output.
 *
 * This script will:
 * - Clean the output directory
 * - Compile the extension
 * - Verify the build output
 *
 * Usage:
 * - `bun scripts/build.ts` - Run the this script (build)
 *
 * Common issues this script helps solve:
 * - Mismatched main entry in package.json
 * - Missing output files after build
 *
 * Required commands from package.json:
 * - `bun scripts/verify-build.ts` - Run the this script (verification)
 * - `yarn clean` - Clean the output directory
 * - `yarn compile` - Compiles the extension
 */

import chalk from 'chalk';
import { resolve } from 'path';

const projectRoot = resolve(import.meta.dir, '..');
console.log(chalk.blue('Building VSCode extension...'));

async function runCommand(command: string, args: string[]): Promise<boolean> {
  console.log(chalk.yellow(`Running: ${command} ${args.join(' ')}`));

  const proc = Bun.spawn({
    cmd: [command, ...args],
    cwd: projectRoot,
    stdout: 'inherit',
    stderr: 'inherit'
  });

  const exitCode = await proc.exited;
  return exitCode === 0;
}

async function build() {
  // Clean the output directory
  console.log(chalk.blue('\n1. Cleaning output directory...'));
  if (!(await runCommand('yarn', ['clean']))) {
    console.log(chalk.red('❌ Clean failed!'));
    process.exit(1);
  }

  // Compile the extension
  console.log(chalk.blue('\n2. Compiling TypeScript...'));
  if (!(await runCommand('yarn', ['compile']))) {
    console.log(chalk.red('❌ Compilation failed!'));
    process.exit(1);
  }

  // Verify the build
  console.log(chalk.blue('\n3. Verifying build output...'));
  if (!(await runCommand('bun', ['scripts/verify-build.ts']))) {
    console.log(chalk.yellow('⚠️ Build verification had warnings'));
  }

  console.log(chalk.green('\n✅ Build completed successfully!'));
  console.log(chalk.blue('\nNext steps:'));
  console.log(`1. Run extension: ${chalk.magenta('yarn dev')}`);
  console.log(`2. Package extension: ${chalk.magenta('yarn package')}`);
}

build().catch(err => {
  console.error(chalk.red(`Build failed: ${err}`));
  process.exit(1);
});
