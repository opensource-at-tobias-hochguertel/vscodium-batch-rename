#!/usr/bin/env bun
// scripts/debug-path.ts

/**
 * VSCode Extension Debug Path Helper
 *
 * Examines the VSCode extension structure and launches VSCode with diagnostics
 * to help debug extension path and loading issues.
 *
 * Environment variables:
 * - `IDE`: The path to the IDE to launch ([default: `code`])
 *
 * This script will:
 * 1. Verify the project structure (package.json)
 * 2. Check for the output directory ([default: `./out`])
 * 3. Launch VSCode with verbose logging and extension development path ([default: `${process.env['IDE'] || 'code'}`, `--verbose`, `--extensionDevelopmentPath=${projectRoot}`, `--disable-extensions`, `--new-window`])
 *
 * Usage:
 * - `bun scripts/debug-path.ts` - Run the path diagnostics
 *
 * Common issues this script helps solve:
 * - Incorrect project structure
 * - Missing output directory
 * - Extension loading path issues
 *
 * Required commands from package.json:
 * none
 */

import { spawn } from 'child_process';
import fs from 'fs';
import { join, resolve } from 'path';

const projectRoot = resolve(import.meta.dir, '..');
console.log(`Project root: ${projectRoot}`);

// Check if package.json exists
const packagePath = join(projectRoot, 'package.json');
if (fs.existsSync(packagePath)) {
  console.log(`✅ package.json found at: ${packagePath}`);
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  console.log(`Extension name: ${pkg.name}`);
} else {
  console.log(`❌ package.json not found at: ${packagePath}`);
}

// Check for output directory
const outDir = join(projectRoot, 'out');
if (fs.existsSync(outDir)) {
  console.log(`✅ Output directory found at: ${outDir}`);
} else {
  console.log(`❌ Output directory not found at: ${outDir}`);
}

// Launch VSCode with diagnostics
console.log('\nLaunching VSCode with diagnostics...');
const child = spawn(`${process.env['IDE'] || 'code'}`, [
  '--verbose',
  `--extensionDevelopmentPath=${projectRoot}`,
  '--disable-extensions',
  '--new-window'
], {
  stdio: 'inherit'
});

child.on('close', (code) => {
  console.log(`VSCode exited with code ${code}`);
});
