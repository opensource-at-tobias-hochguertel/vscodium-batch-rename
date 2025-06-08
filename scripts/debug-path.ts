#!/usr/bin/env bun

import { spawn } from 'child_process';
import { join, resolve } from 'path';
import fs from 'fs';

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
const child = spawn('code', [
  '--verbose',
  '--extensionDevelopmentPath=' + projectRoot,
  '--disable-extensions',
  '--new-window'
], {
  stdio: 'inherit'
});

child.on('close', (code) => {
  console.log(`VSCode exited with code ${code}`);
});
