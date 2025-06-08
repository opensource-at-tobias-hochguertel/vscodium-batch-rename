#!/usr/bin/env bun
// scripts/create-playground.ts

/**
 * Playground Generator for Batch Rename Extension Testing
 *
 * Creates a structured test environment with various file types and naming patterns
 * to thoroughly test the batch rename extension functionality.
 */

import chalk from 'chalk';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

// Configuration
const ROOT_DIR = join(import.meta.dir, '..');
const PLAYGROUND_DIR = join(ROOT_DIR, 'playground');

// File structure definition
interface FileStructure {
  [key: string]: string | FileStructure;
}

// Sample content for different file types
const FILE_CONTENTS: Record<string, string> = {
  '.ts': 'export function example() {\n  console.log("This is a TypeScript file");\n}\n',
  '.tsx': 'import React from "react";\n\nexport const Component = () => <div>Example Component</div>;\n',
  '.json': '{\n  "name": "example",\n  "version": "1.0.0"\n}\n',
  '.md': '# Example Markdown\n\nThis is a sample markdown file for testing.\n',
  '.txt': 'This is a sample text file for testing the batch rename extension.\n',
  '.csv': 'id,name,value\n1,item1,100\n2,item2,200\n',
  '.jpg': '<!-- Mock image file content -->',
  '.png': '<!-- Mock image file content -->'
};

// Get content based on file extension
function getContentForFile(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.'));
  return FILE_CONTENTS[ext] || `Sample content for ${filename}`;
}

// Define playground structure
const structure: FileStructure = {
  'images': {
    'image001.jpg': '',
    'image002.jpg': '',
    'image003.jpg': '',
    'screenshot_2023-01-01.png': '',
    'screenshot_2023-01-02.png': '',
    'banner-header.png': ''
  },
  'documents': {
    'report_q1_2023.txt': '',
    'report_q2_2023.txt': '',
    'report_q3_2023.txt': '',
    'meeting-notes-jan.md': '',
    'meeting-notes-feb.md': ''
  },
  'source': {
    'main.ts': '',
    'helper.ts': '',
    'utils.ts': '',
    'component1.tsx': '',
    'component2.tsx': ''
  },
  'data': {
    'data_set_1.csv': '',
    'data_set_2.csv': '',
    'config.json': '',
    'settings.json': ''
  },
  'misc': {
    'file with spaces.txt': '',
    'file-with-dashes.txt': '',
    'file_with_underscores.txt': '',
    'file.with.dots.txt': '',
    'file(with)parentheses.txt': ''
  }
};

// Create directory recursively
async function createDir(path: string): Promise<void> {
  try {
    await mkdir(path, { recursive: true });
    console.log(chalk.green(`✅ Created directory: ${path}`));
  } catch (error) {
    console.error(chalk.red(`❌ Failed to create directory ${path}: ${error}`));
    throw error;
  }
}

// Create file with content
async function createFile(path: string, filename: string): Promise<void> {
  const filePath = join(path, filename);
  try {
    await writeFile(filePath, getContentForFile(filename));
    console.log(chalk.blue(`📄 Created file: ${filePath}`));
  } catch (error) {
    console.error(chalk.red(`❌ Failed to create file ${filePath}: ${error}`));
    throw error;
  }
}

// Process structure recursively
async function createStructure(
  basePath: string,
  structure: FileStructure
): Promise<void> {
  for (const [name, content] of Object.entries(structure)) {
    const path = join(basePath, name);

    if (typeof content === 'object') {
      // It's a directory
      await createDir(path);
      await createStructure(path, content);
    } else {
      // It's a file
      await createFile(basePath, name);
    }
  }
}

// Main function
async function main(): Promise<void> {
  console.log(chalk.yellow('🚀 Creating playground structure for batch rename extension testing...'));

  try {
    // Create playground root
    await createDir(PLAYGROUND_DIR);

    // Create the structure
    await createStructure(PLAYGROUND_DIR, structure);

    console.log(chalk.green('\n✅ Playground successfully created at:'));
    console.log(chalk.green(PLAYGROUND_DIR));
    console.log(chalk.blue('\nYou can now use this directory to test the batch rename extension.'));
    console.log(chalk.blue('1. Open the playground folder in VSCode'));
    console.log(chalk.blue('2. Select multiple files in a directory'));
    console.log(chalk.blue('3. Right-click and select "Batch Rename"'));
    console.log(chalk.blue('4. Edit the names and save to test the functionality'));
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to create playground: ${error}`));
    process.exit(1);
  }
}

// Run the script
main();
