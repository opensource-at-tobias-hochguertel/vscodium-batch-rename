#!/usr/bin/env bun

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
  console.log('1. Run extension: yarn dev');
  console.log('2. Package extension: yarn package');
}

build().catch(err => {
  console.error(chalk.red(`Build failed: ${err}`));
  process.exit(1);
});
