# 🔄 Batch Rename (Fork)

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://marketplace.visualstudio.com/items?itemName=TobiasHochguertel.batch-rename-fork)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Downloads](https://img.shields.io/badge/downloads-1K-brightgreen.svg)](https://marketplace.visualstudio.com/items?itemName=TobiasHochguertel.batch-rename-fork)

A modern, type-safe fork of the original Batch Rename extension with improved error handling, enhanced UX, and robust TypeScript implementation.

Rename multiple files simultaneously inside the editor window, leveraging VS Code's powerful editing features like find/replace, multi-cursor, and regex.

## ✨ Features

- 📝 **Batch editing** - Rename multiple files in a single editor session
- 🔍 **Find & replace** - Use VS Code's built-in search and replace functionality
- ⚡ **Fast operation** - Asynchronous implementation prevents UI freezing
- 🔄 **Undo support** - Change your mind? Just press Ctrl+Z
- 🔔 **Clear feedback** - Detailed success and error notifications

![Demo GIF](https://raw.githubusercontent.com/tobiashochguertel/vscodium-batch-rename/main/media/demo.gif)

## 🚀 How To Use

1. **Select files** in the explorer sidebar
2. **Right-click** one of the files and select "Batch Rename"
3. **Edit file names** in the editor that appears
4. **Hit Save** to confirm changes
5. Review results in the notification summary

## 🛠️ What's Improved in this Fork

### For Users

- **Better Reliability**: Operations succeed even in complex scenarios
- **Detailed Feedback**: Clear success/failure messages for each renamed file
- **Smoother Experience**: No UI freezing during long operations
- **Undo Support**: Press Ctrl+Z to undo your batch rename operations
- **Error Recovery**: If some files fail, others still complete successfully

### Under the Hood

- **Enhanced Type Safety**: Full TypeScript implementation with proper type checking
- **Resilient Architecture**: Operations gracefully handle errors without crashing
- **Session Management**: Internal tracking of files across rename operations
- **Context Isolation**: Properly managed extension context with singleton pattern
- **Progressive Enhancement**: Core functionality works even when advanced features fail

## ⚙️ Extension Settings

This extension contributes the following settings:

- `batchRename.preserveExtension`: Automatically preserve file extensions during rename (default: `true`)
- `batchRename.closeOnSave`: Automatically close the rename editor on save (default: `true`)
- `batchRename.confirmOnSave`: Show confirmation dialog before applying renames (default: `false`)

## 📋 Power User Tips

### Multi-Cursor Editing

Use <kbd>Alt</kbd>+<kbd>Click</kbd> to place multiple cursors or <kbd>Ctrl</kbd>+<kbd>D</kbd> to select multiple occurrences.

```
component.tsx
component.css
component.test.tsx
```

Place cursors at the beginning of each line and edit them all at once:

```
Button.tsx
Button.css
Button.test.tsx
```

### Regex Find & Replace

Use VS Code's find and replace with regex to perform complex renaming patterns:

1. Press <kbd>Ctrl</kbd>+<kbd>F</kbd> to open search
2. Enable regex mode with <kbd>Alt</kbd>+<kbd>R</kbd>
3. Find pattern: `(.*?)\.component\.ts$`
4. Replace with: `$1.controller.ts`

Result: All files ending with `.component.ts` will be renamed to `.controller.ts`

### Batch Numbering

Use multi-cursor to quickly create numbered sequences:

1. Select all lines with <kbd>Ctrl</kbd>+<kbd>A</kbd>
2. Place cursors at the end with <kbd>End</kbd> key
3. Type a common prefix
4. Press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> (Column Selection mode)
5. Add sequential numbers

## 📚 Technical Implementation

The extension uses several VS Code APIs working together:

- **Workspace Edit API**: Performs file renames in a single atomic operation
- **Text Document API**: Manages the rename editor session
- **Editor Anchoring**: Creates reference points for undo/redo operations
- **Context State Management**: Persists session information across VS Code restarts

When you save the rename editor:

1. The extension validates all operations for potential conflicts
2. A workspace edit is created and applied as a single transaction
3. The operation is tracked for undo support
4. Results are analyzed and reported in a notification

## 🗺️ Roadmap

### Next

- [ ] 🔄 Improve Undo/Redo support without requiring editor anchoring
- [ ] 📈 Add progress indicators during long operations

### Done

- [x] 🔄 Basic undo/redo support via editor anchoring
- [x] 🛡️ Enhanced error handling and recovery
- [x] ⚡ Asynchronous operation for better performance

### Backlog

- [ ] 🧩 Create initial tests
- [ ] 📝 Add support for folders
- [ ] 🌍 Add multi-language support
- [ ] 📊 Add statistics and operation history
- ~~[ ] 🖼️ Add preview functionality~~
- ~~[ ] 🧩 Implement pattern-based renaming~~

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 Credits

This extension is a fork of the original [Batch Rename](https://github.com/JannisX11/batch-rename) extension by JannisX11.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Enjoy batch renaming with power and safety!** 💪
