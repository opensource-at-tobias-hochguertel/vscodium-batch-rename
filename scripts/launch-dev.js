// scripts/launch-dev.js
const { spawnSync } = require('child_process');
const path = require('path');

// First compile
spawnSync('yarn', ['run', 'compile'], { stdio: 'inherit' });

// Then launch VSCode with extension
spawnSync(
  'windsurf',
  [
    '--extensionDevelopmentPath=' + path.resolve(__dirname, '..')
  ],
  { stdio: 'inherit' }
);
