#!/usr/bin/env bun
// scripts/verify-build.ts

/**
 * VSCode Extension Build Verifier
 *
 * Verifies the extension build output and checks for the main file.
 *
 * This script will:
 * - Check if the main file exists
 * - Check if the source map exists
 * - Check if the output directory exists
 * - If main file is not found, search for potential extension files
 * - Provide build recommendations
 *
 * Usage:
 * - `bun scripts/verify-build.ts` - Run the this script (verification)
 *
 * Common issues this script helps solve:
 * - Mismatched main entry in package.json
 * - Missing output files after build
 * - Identifying potential extension files when build output is in unexpected location
 *
 * Required commands from package.json:
 * - `bun scripts/build.ts` - Run the this script (build)
 */

import chalk from 'chalk';
import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const projectRoot = resolve(import.meta.dir, '..');
const packageJson = JSON.parse(await Bun.file(join(projectRoot, 'package.json')).text());

// Extract main path without .js extension if present
const mainPath = packageJson.main.replace(/\.js$/, '');
const mainFilePath = join(projectRoot, `${mainPath}.js`);

console.log(chalk.blue('Verifying extension build output...'));
console.log(`Main file path in package.json: ${chalk.yellow(mainPath)}`);

if (existsSync(mainFilePath)) {
  console.log(chalk.green(`✅ Main file exists at: ${mainFilePath}`));
} else {
  console.log(chalk.red(`❌ Main file NOT found at: ${mainFilePath}`));

  // Try to locate where the file might be
  const outDir = join(projectRoot, 'out');
  if (existsSync(outDir)) {
    console.log(chalk.yellow('Searching in output directory...'));

    function findJsFiles(dir: string, fileList: string[] = []): string[] {
      const files = readdirSync(dir, { withFileTypes: true });

      for (const file of files) {
        if (file.isDirectory()) {
          findJsFiles(join(dir, file.name), fileList);
        } else if (file.name.endsWith('.js') && file.name.includes('extension')) {
          fileList.push(join(dir, file.name));
        }
      }

      return fileList;
    }

    const potentialFiles = findJsFiles(outDir);
    if (potentialFiles.length > 0) {
      console.log(chalk.yellow('Found potential extension files:'));
      potentialFiles.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.replace(projectRoot, '')}`);
      });
      console.log(chalk.yellow(`Update package.json "main" to one of these paths (relative to project root)`));
    } else {
      console.log(chalk.red('No potential extension files found. Did compilation succeed?'));
    }
  } else {
    console.log(chalk.red(`Output directory not found at: ${outDir}`));
  }
}

// Check for source maps
const mapFile = `${mainFilePath}.map`;
if (existsSync(mapFile)) {
  console.log(chalk.green(`✅ Source map exists at: ${mapFile}`));
} else {
  console.log(chalk.yellow(`⚠️ Source map not found at: ${mapFile}`));
}

console.log(chalk.blue('\nBuild Recommendations:'));
console.log('1. Run: yarn clean && yarn compile');
console.log('2. Verify output structure with: bun scripts/verify-build.ts');
console.log('3. Update package.json "main" if necessary');
