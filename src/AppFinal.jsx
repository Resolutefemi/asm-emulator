// src/AppFinal.jsx
import React, { useState, useRef, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { darcula } from '@uiw/codemirror-theme-darcula';
import { Decoration, ViewPlugin } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { Emulator8086 } from './emulator/Emulator8086';
import { INSTRUCTION_SET, FLAG_BITS, searchInstructions } from './data/InstructionSet8086';
import SplashScreen from './components/SplashScreen';
import './styles/AppFinal.css';

// Custom CodeMirror 6 Syntax Highlighter plugin for 8086 Assembly
const asmHighlightPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = this.getDecorations(view);
  }

  update(update) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.getDecorations(update.view);
    }
  }

  getDecorations(view) {
    const builder = new RangeSetBuilder();
    
    // Define markers for token classes
    const commentDeco = Decoration.mark({ class: "cm-asm-comment" });
    const instrDeco = Decoration.mark({ class: "cm-asm-instruction" });
    const regDeco = Decoration.mark({ class: "cm-asm-register" });
    const numDeco = Decoration.mark({ class: "cm-asm-number" });
    const labelDeco = Decoration.mark({ class: "cm-asm-label" });
    const directiveDeco = Decoration.mark({ class: "cm-asm-directive" });

    // Assembly instructions list
    const instructions = /^(mov|add|sub|cmp|jmp|je|jz|jne|jnz|js|jns|jc|jb|jnc|jae|jo|jno|ja|jnbe|jbe|jna|jg|jnle|jge|jnl|jl|jnge|jle|jng|loop|call|ret|xor|and|or|inc|dec|push|pop|int|hlt|nop|lea)$/i;
    // 8086 registers list
    const registers = /^(ax|bx|cx|dx|si|di|bp|sp|ah|al|bh|bl|ch|cl|dh|dl|cs|ds|ss|es)$/i;
    // Directives list
    const directives = /^(\.model|\.stack|\.data|\.code|db|dw|dd|org|assume|end|proc|endp|segment|ends)$/i;

    for (let { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to);
      let pos = from;
      const lines = text.split('\n');
      
      lines.forEach((line) => {
        let linePos = pos;
        const lineDecorations = [];
        
        // Match comments first
        const commentMatch = line.match(/;.*$/);
        let codePart = line;
        if (commentMatch) {
          const commentStart = line.indexOf(commentMatch[0]);
          lineDecorations.push({
            from: linePos + commentStart,
            to: linePos + line.length,
            deco: commentDeco
          });
          codePart = line.substring(0, commentStart);
        }

        // Match tokens inside the code part
        const tokenRegex = /([a-zA-Z_@][a-zA-Z0-9_]*:?)|(0x[0-9a-fA-F]+|[0-9a-fA-F]+h|[0-9]+b?)/g;
        let match;
        while ((match = tokenRegex.exec(codePart)) !== null) {
          const token = match[0];
          const tokenStart = match.index;
          const tokenEnd = tokenStart + token.length;
          
          let deco = null;
          if (token.endsWith(':')) {
            deco = labelDeco;
          } else if (instructions.test(token)) {
            deco = instrDeco;
          } else if (registers.test(token)) {
            deco = regDeco;
          } else if (directives.test(token)) {
            deco = directiveDeco;
          } else if (/^[0-9]/.test(token) || token.startsWith('0x') || token.endsWith('h')) {
            deco = numDeco;
          }
          
          if (deco) {
            lineDecorations.push({
              from: linePos + tokenStart,
              to: linePos + tokenEnd,
              deco: deco
            });
          }
        }

        // Sort decorations by 'from' in ascending order to prevent CodeMirror RangeSetBuilder crashes
        lineDecorations.sort((a, b) => a.from - b.from);

        // Add to builder
        lineDecorations.forEach(d => {
          builder.add(d.from, d.to, d.deco);
        });

        pos += line.length + 1; // +1 for newline character
      });
    }
    return builder.finish();
  }
}, {
  decorations: v => v.decorations
});

export default function AppFinal() {
  const [showSplash, setShowSplash] = useState(true);
  const [code, setCode] = useState(`; Renance Playground - Default Assembly Code\nmov ax, 0x1234\nadd ax, 0x5678\nhlt\n`);

  const [emulatorState, setEmulatorState] = useState({
    registers: { ax: 0, bx: 0, cx: 0, dx: 0, si: 0, di: 0, bp: 0, sp: 0xFFFF, cs: 0, ds: 0, ss: 0, es: 0 },
    flags: { cf: 0, pf: 0, af: 0, zf: 0, sf: 0, of: 0 },
    ip: 0,
    memory: new Array(65536).fill(0),
    output: [],
    running: false,
  });

  const [activeTab, setActiveTab] = useState('cpu');
  const [showReference, setShowReference] = useState(window.innerWidth > 1024);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState(window.innerWidth < 768);
  const [terminalOpen, setTerminalOpen] = useState(true); // Open terminal by default
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [isDragging, setIsDragging] = useState(false);

  const emulatorRef = useRef(new Emulator8086());
  const autoSaveTimerRef = useRef(null);
  const terminalRef = useRef(null);
  const dragStartY = useRef(0);

  // Git Bash style terminal states
  const [terminalHistory, setTerminalHistory] = useState([
    { type: 'welcome', text: 'Microsoft Windows [Version 10.0.22631]' },
    { type: 'welcome', text: '(c) Microsoft Corporation. All rights reserved.' },
    { type: 'welcome', text: '\nRenance MINGW64 Bash Terminal (MASM/TASM 8086 Compiler Simulation)' },
    { type: 'info', text: 'Type "help" to see available commands. Current source file is "main.asm".\n' }
  ]);
  const [terminalInput, setTerminalInput] = useState('');
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [virtualDirs, setVirtualDirs] = useState(['src', 'docs']);
  const [virtualFiles, setVirtualFiles] = useState({
    'readme.txt': 'Renance MASM/TASM compiler workspace.\n\nInstructions:\n1. Type "tasm hello.asm" to compile the active editor code into an object file.\n2. Type "tlink hello.obj" to link the object file into an executable.\n3. Type "hello.exe" to execute the binary and display outputs.\n4. You can also create files/folders in the sidebar explorer like VS Code!\n',
    'src/main.asm': `; Renance Playground - Default Assembly Code\nmov ax, 0x1234\nadd ax, 0x5678\nhlt\n`,
    'src/hello.asm': `.MODEL SMALL\n.STACK 100H\n.DATA\n    MSG DB 'How are you doing$'\n.CODE\nMAIN PROC\n    MOV AX, @DATA\n    MOV DS, AX\n    LEA DX, MSG\n    MOV AH, 09H\n    INT 21H\n    MOV AH, 4CH\n    INT 21H\nMAIN ENDP\nEND MAIN\n`
  });
  const [activeFile, setActiveFile] = useState('src/main.asm');
  const [fileExplorerOpen, setFileExplorerOpen] = useState(window.innerWidth > 1024);
  const [isCompiled, setIsCompiled] = useState(false);
  const [isLinked, setIsLinked] = useState(false);
  const [exeName, setExeName] = useState('main.exe');
  const [memoryBaseAddress, setMemoryBaseAddress] = useState(0);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setMobileView(isMobile);
      setShowReference(window.innerWidth > 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Terminal drag handling
  const handleTerminalMouseDown = (e) => {
    if (e.target.closest('.terminal-handle')) {
      setIsDragging(true);
      dragStartY.current = e.clientY;
    }
  };

  const handleTerminalTouchStart = (e) => {
    if (e.target.closest('.terminal-handle')) {
      setIsDragging(true);
      dragStartY.current = e.touches[0].clientY;
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const deltaY = dragStartY.current - e.clientY;
      const newHeight = Math.max(100, Math.min(600, terminalHeight + deltaY));
      setTerminalHeight(newHeight);
      dragStartY.current = e.clientY;
    };

    const handleTouchMove = (e) => {
      if (!isDragging) return;

      const deltaY = dragStartY.current - e.touches[0].clientY;
      const newHeight = Math.max(100, Math.min(600, terminalHeight + deltaY));
      setTerminalHeight(newHeight);
      dragStartY.current = e.touches[0].clientY;
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchend', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isDragging, terminalHeight]);

  // Auto-save VFS and editor progress to IndexedDB
  useEffect(() => {
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveToIndexedDB('asmCode', code);
      saveToIndexedDB('virtualFiles', virtualFiles);
      saveToIndexedDB('virtualDirs', virtualDirs);
      saveToIndexedDB('activeFile', activeFile);
    }, 1000);

    return () => clearTimeout(autoSaveTimerRef.current);
  }, [code, virtualFiles, virtualDirs, activeFile]);

  // Load progress from IndexedDB on mount
  useEffect(() => {
    Promise.all([
      loadFromIndexedDB('asmCode'),
      loadFromIndexedDB('virtualFiles'),
      loadFromIndexedDB('virtualDirs'),
      loadFromIndexedDB('activeFile')
    ]).then(([savedCode, savedFiles, savedDirs, savedActiveFile]) => {
      if (savedFiles) setVirtualFiles(savedFiles);
      if (savedDirs) setVirtualDirs(savedDirs);
      if (savedActiveFile) setActiveFile(savedActiveFile);
      if (savedCode) setCode(savedCode);
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const runCode = () => {
    try {
      setTerminalOpen(true);
      const isCom = /org\s+100h/i.test(code);
      const ext = isCom ? 'main.com' : 'main.exe';
      setExeName(ext);
      
      const newHistory = [
        ...terminalHistory,
        { type: 'prompt', text: `run shortcut (tasm + tlink + execution)` },
        { type: 'info', text: 'Assembling file:   MAIN.ASM' },
      ];

      // Assemble
      emulatorRef.current.load(code);
      setIsCompiled(true);
      
      // Link
      setIsLinked(true);

      // Run
      const output = emulatorRef.current.run();
      
      const runHistory = [
        { type: 'info', text: 'Error messages:    None' },
        { type: 'info', text: 'Warning messages:  None' },
        { type: 'info', text: `Linking file:      MAIN.OBJ` },
        { type: 'info', text: `Output file:       ${ext.toUpperCase()}` },
        { type: 'info', text: `Executing ${ext.toUpperCase()}...` },
      ];

      output.forEach(line => {
        runHistory.push({ type: 'success', text: line });
      });

      runHistory.push({ type: 'info', text: 'Program terminated successfully.' });

      setTerminalHistory([...newHistory, ...runHistory]);

      // Sync register states
      setEmulatorState({
        registers: { ...emulatorRef.current.registers },
        flags: { ...emulatorRef.current.flags },
        ip: emulatorRef.current.ip,
        memory: [...emulatorRef.current.memory],
        output: [...output],
        running: false,
      });

      setActiveTab('cpu');
    } catch (err) {
      setTerminalHistory(prev => [
        ...prev,
        { type: 'prompt', text: 'run shortcut (tasm + tlink + execution)' },
        { type: 'error', text: `**Error**: ${err.message}` }
      ]);
      setEmulatorState(prev => ({ ...prev, running: false }));
    }
  };

  const stepCode = () => {
    try {
      setTerminalOpen(true);
      let isNewStart = false;

      // Compile if not compiled yet
      if (!isCompiled) {
        emulatorRef.current.load(code);
        setIsCompiled(true);
        setIsLinked(true); // Auto link for step debug
        isNewStart = true;
      }

      const currentIp = emulatorRef.current.ip;
      if (currentIp >= emulatorRef.current.code.length) {
        setTerminalHistory(prev => [
          ...prev,
          { type: 'info', text: '🔔 Program execution completed. Reset to run again.' }
        ]);
        return;
      }

      const instruction = emulatorRef.current.code[currentIp];
      const result = emulatorRef.current.step();

      const stepLog = result.instruction 
        ? `${result.instruction.instr} ${result.instruction.args.join(', ')}`
        : 'nop';

      const stepOutput = emulatorRef.current.output;
      const printLines = stepOutput.slice(emulatorState.output.length);

      const terminalLogs = [
        { type: 'info', text: `Step [IP=0x${currentIp.toString(16).toUpperCase()}]: ${stepLog}` }
      ];
      printLines.forEach(line => {
        terminalLogs.push({ type: 'success', text: line });
      });

      if (result.halted) {
        terminalLogs.push({ type: 'info', text: '✓ CPU halted (program end)' });
      }

      setTerminalHistory(prev => [...prev, ...terminalLogs]);

      // Sync register states
      setEmulatorState({
        registers: { ...emulatorRef.current.registers },
        flags: { ...emulatorRef.current.flags },
        ip: emulatorRef.current.ip,
        memory: [...emulatorRef.current.memory],
        output: [...stepOutput],
        running: !result.halted,
      });

      setActiveTab('cpu');
    } catch (err) {
      setTerminalHistory(prev => [
        ...prev,
        { type: 'error', text: `**Debug Error**: ${err.message}` }
      ]);
    }
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Avoid conflicts if typing in input fields
      const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) ||
                      document.activeElement.classList.contains('cm-content');
      
      // Override F5 and F10 globally for IDE execution convenience
      if (e.key === 'F5') {
        e.preventDefault();
        runCode();
      } else if (e.key === 'F10') {
        e.preventDefault();
        stepCode();
      } else if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        resetCode();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [code, isCompiled, isLinked]);

  const downloadAsmFile = () => {
    const element = document.createElement("a");
    const file = new Blob([code], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = "program.asm";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // File Explorer VFS Helper
  const getFileTree = () => {
    const tree = { folders: {}, rootFiles: [] };
    const allowedExtensions = ['.asm', '.md', '.txt'];
    
    // Initialize folders
    virtualDirs.forEach(dir => {
      tree.folders[dir] = [];
    });
    
    // Distribute files with filtering
    Object.keys(virtualFiles).forEach(filepath => {
      // Strict Extension Filtering
      const hasAllowedExtension = allowedExtensions.some(ext => filepath.toLowerCase().endsWith(ext));
      if (!hasAllowedExtension) return;

      const parts = filepath.split('/');
      if (parts.length > 1) {
        const folder = parts[0];
        if (!tree.folders[folder]) {
          tree.folders[folder] = [];
        }
        tree.folders[folder].push({
          name: parts.slice(1).join('/'),
          path: filepath
        });
      } else {
        tree.rootFiles.push({
          name: filepath,
          path: filepath
        });
      }
    });
    return tree;
  };

  const selectActiveFile = (filepath) => {
    const allowedExtensions = ['.asm', '.md', '.txt'];
    const hasAllowedExtension = allowedExtensions.some(ext => filepath.toLowerCase().endsWith(ext));
    if (!hasAllowedExtension) {
      console.warn(`File extension not allowed: ${filepath}`);
      return;
    }

    // 1. Save current editor code to the old active file
    if (activeFile) {
      setVirtualFiles(prev => ({
        ...prev,
        [activeFile]: code
      }));
    }
    // 2. Set new active file
    setActiveFile(filepath);
    // 3. Load code into editor
    setCode(virtualFiles[filepath] || '');
  };

  const triggerCreateFile = () => {
    setIsCreatingFile(true);
    setIsCreatingFolder(false);
    setNewItemName('');
  };

  const triggerCreateFolder = () => {
    setIsCreatingFolder(true);
    setIsCreatingFile(false);
    setNewItemName('');
  };

  const handleNewFileSubmit = (val) => {
    const filename = (val !== undefined ? val : newItemName).trim();
    if (!filename) {
      setIsCreatingFile(false);
      return;
    }
    if (virtualFiles[filename] !== undefined) {
      alert("File already exists!");
      setIsCreatingFile(false);
      return;
    }
    const parts = filename.split('/');
    if (parts.length > 1) {
      const folder = parts[0];
      if (!virtualDirs.includes(folder)) {
        setVirtualDirs(prev => [...prev, folder]);
      }
    }
    setVirtualFiles(prev => ({
      ...prev,
      [filename]: "; New assembly file\n"
    }));
    setActiveFile(filename);
    setCode("; New assembly file\n");
    setIsCreatingFile(false);
    setNewItemName('');
  };

  const handleNewFolderSubmit = (val) => {
    const foldername = (val !== undefined ? val : newItemName).trim();
    if (!foldername) {
      setIsCreatingFolder(false);
      return;
    }
    if (virtualDirs.includes(foldername)) {
      alert("Folder already exists!");
      setIsCreatingFolder(false);
      return;
    }
    setVirtualDirs(prev => [...prev, foldername]);
    setIsCreatingFolder(false);
    setNewItemName('');
  };

  const handleInlineInputKeyDown = (e, type) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (type === 'file') {
        handleNewFileSubmit(e.target.value);
      } else {
        handleNewFolderSubmit(e.target.value);
      }
    } else if (e.key === 'Escape') {
      setIsCreatingFile(false);
      setIsCreatingFolder(false);
      setNewItemName('');
    }
  };

  const deleteFile = (filepath) => {
    if (!window.confirm(`Are you sure you want to delete '${filepath}'?`)) return;
    setVirtualFiles(prev => {
      const copy = { ...prev };
      delete copy[filepath];
      return copy;
    });
    // If deleted active file, load another one
    if (activeFile === filepath) {
      const remaining = Object.keys(virtualFiles).filter(f => f !== filepath);
      if (remaining.length > 0) {
        setActiveFile(remaining[0]);
        setCode(virtualFiles[remaining[0]]);
      } else {
        setActiveFile(null);
        setCode('');
      }
    }
  };

  const deleteFolder = (folderName) => {
    if (!window.confirm(`Are you sure you want to delete folder '${folderName}' and all its contents?`)) return;
    setVirtualDirs(prev => prev.filter(d => d !== folderName));
    setVirtualFiles(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(filepath => {
        if (filepath.startsWith(folderName + '/')) {
          delete copy[filepath];
        }
      });
      return copy;
    });
    // If active file was in deleted folder, load another one
    if (activeFile && activeFile.startsWith(folderName + '/')) {
      const remaining = Object.keys(virtualFiles).filter(f => !f.startsWith(folderName + '/'));
      if (remaining.length > 0) {
        setActiveFile(remaining[0]);
        setCode(virtualFiles[remaining[0]]);
      } else {
        setActiveFile(null);
        setCode('');
      }
    }
  };

  const resetCode = () => {
    emulatorRef.current.reset();
    setEmulatorState({
      registers: { ax: 0, bx: 0, cx: 0, dx: 0, si: 0, di: 0, bp: 0, sp: 0xFFFF, cs: 0, ds: 0, ss: 0, es: 0 },
      flags: { cf: 0, pf: 0, af: 0, zf: 0, sf: 0, of: 0 },
      ip: 0,
      memory: new Array(65536).fill(0),
      output: [],
      running: false,
    });
    setIsCompiled(false);
    setIsLinked(false);
    setTerminalHistory(prev => [
      ...prev,
      { type: 'info', text: '🔄 CPU and assembly workspace reset.' }
    ]);
  };

  const clearCode = () => {
    setCode('');
    resetCode();
  };

  const clearTerminal = () => {
    setTerminalHistory([]);
  };

  const insertInstruction = (instr) => {
    setCode(code + '\n' + instr + ' ');
  };

  // Handle command execution
  const handleCommandSubmit = async (e) => {
    e.preventDefault();
    const input = terminalInput.trim();
    if (!input) return;

    // Add prompt line to console logs
    const newHistory = [...terminalHistory, { type: 'prompt', text: input }];
    const newCmdHistory = [input, ...commandHistory];
    setCommandHistory(newCmdHistory);
    setHistoryIndex(-1);
    setTerminalInput('');

    // Tokenize command
    const args = input.split(/\s+/);
    const cmd = args[0].toLowerCase();
    const arg1 = args[1] ? args[1].toLowerCase() : null;

    let response = [];

    if (cmd === 'clear') {
      setTerminalHistory([]);
      return;
    } else if (cmd === 'help') {
      response = [
        { type: 'info', text: 'Available commands:' },
        { type: 'info', text: '  tasm <file.asm>  - Compile assembly code in editor or local file (e.g. hello.asm) to main.obj' },
        { type: 'info', text: '  tlink <file.obj> - Link main.obj (or other compiled obj) to executable' },
        { type: 'info', text: '  main.exe         - Run compiled and linked executable (also supports custom names, e.g. hello.exe)' },
        { type: 'info', text: '  ls / dir         - List files in current directory' },
        { type: 'info', text: '  cat <file>       - Output contents of a file' },
        { type: 'info', text: '  clear            - Clear terminal screen' },
        { type: 'info', text: '  help             - Show this help menu' }
      ];
    } else if (cmd === 'ls' || cmd === 'dir') {
      const allowedExtensions = ['.asm', '.md', '.txt'];
      if (window.__TAURI__) {
        try {
          // Read actual local workspace files!
          const entries = await window.__TAURI__.fs.readDir('.', { recursive: false });
          const realFiles = entries
            .filter(e => e.children || allowedExtensions.some(ext => e.name.toLowerCase().endsWith(ext)))
            .map(e => `${e.name.padEnd(20)} ${e.children ? '<DIR>' : `${e.size || 0} bytes`}`);
          response = realFiles.map(f => ({ type: 'info', text: f }));
        } catch (err) {
          const filesList = Object.entries(virtualFiles)
            .filter(([path]) => allowedExtensions.some(ext => path.toLowerCase().endsWith(ext)))
            .map(([path, content]) => {
              const size = content ? content.length : 0;
              return `${path.padEnd(25)} ${size} bytes`;
            });
          response = filesList.map(f => ({ type: 'info', text: f }));
        }
      } else {
        const filesList = Object.entries(virtualFiles)
          .filter(([path]) => allowedExtensions.some(ext => path.toLowerCase().endsWith(ext)))
          .map(([path, content]) => {
            const size = content ? content.length : 0;
            return `${path.padEnd(25)} ${size} bytes`;
          });
        response = filesList.map(f => ({ type: 'info', text: f }));
      }
    } else if (cmd === 'cat') {
      const allowedExtensions = ['.asm', '.md', '.txt'];
      if (!arg1) {
        response = [{ type: 'error', text: 'cat: missing filename' }];
      } else {
        const hasAllowedExtension = allowedExtensions.some(ext => arg1.toLowerCase().endsWith(ext));
        if (!hasAllowedExtension) {
          response = [{ type: 'error', text: `cat: ${args[1]}: Permission denied (extension not allowed)` }];
        } else {
          const matchedFile = Object.keys(virtualFiles).find(f => f.toLowerCase() === arg1.toLowerCase() || f.split('/').pop().toLowerCase() === arg1.toLowerCase());
          if (matchedFile) {
            response = [{ type: 'info', text: virtualFiles[matchedFile] }];
          } else if (window.__TAURI__) {
            try {
              const fileContent = await window.__TAURI__.fs.readTextFile(args[1]);
              response = [{ type: 'info', text: fileContent }];
            } catch (err) {
              response = [{ type: 'error', text: `cat: ${args[1]}: No such file or directory` }];
            }
          } else {
            response = [{ type: 'error', text: `cat: ${args[1]}: No such file or directory` }];
          }
        }
      }
    } else if (cmd === 'tasm') {
      if (!arg1) {
        response = [{ type: 'error', text: 'tasm: missing filename' }];
      } else {
        const matchedFile = Object.keys(virtualFiles).find(f => f.toLowerCase() === arg1.toLowerCase() || f.split('/').pop().toLowerCase() === arg1.toLowerCase());
        if (matchedFile) {
          response.push({ type: 'info', text: 'Turbo Assembler  Version 3.0  Copyright (c) 1988, 1991 Borland International' });
          response.push({ type: 'info', text: `Assembling file:   ${arg1.toUpperCase()}` });
          try {
            const fileContent = virtualFiles[matchedFile];
            emulatorRef.current.parse(fileContent);
            setIsCompiled(true);
            response.push({ type: 'info', text: 'Error messages:    None' });
            response.push({ type: 'info', text: 'Warning messages:  None' });
            response.push({ type: 'info', text: 'Passes:            1' });
            response.push({ type: 'info', text: 'Remaining memory:  415k' });
          } catch (err) {
            response.push({ type: 'error', text: `**Error** ${arg1.toUpperCase()}: ${err.message}` });
            response.push({ type: 'error', text: 'Error messages:    1' });
            response.push({ type: 'info', text: 'Warning messages:  None' });
          }
        } else if (window.__TAURI__) {
          try {
            const localCode = await window.__TAURI__.fs.readTextFile(args[1]);
            const baseName = args[1].split(/[\\/]/).pop().toLowerCase();
            response.push({ type: 'info', text: 'Turbo Assembler  Version 3.0  Copyright (c) 1988, 1991 Borland International' });
            response.push({ type: 'info', text: `Assembling file:   ${args[1].toUpperCase()}` });

            emulatorRef.current.parse(localCode);
            setVirtualFiles(prev => ({ ...prev, [baseName]: localCode }));
            setIsCompiled(true);
            response.push({ type: 'info', text: 'Error messages:    None' });
            response.push({ type: 'info', text: 'Warning messages:  None' });
            response.push({ type: 'info', text: 'Passes:            1' });
            response.push({ type: 'info', text: 'Remaining memory:  415k' });
          } catch (err) {
            response.push({ type: 'error', text: `**Error** ${args[1]}: ${err.message}` });
            response.push({ type: 'error', text: 'Error messages:    1' });
          }
        } else {
          response = [{ type: 'error', text: `tasm: ${args[1]}: File not found` }];
        }
      }
    } else if (cmd === 'tlink') {
      if (!arg1) {
        response = [{ type: 'error', text: 'tlink: missing filename' }];
      } else {
        const baseName = arg1.replace(/\.obj$/, '');
        const asmName = baseName + '.asm';
        const matchedFile = Object.keys(virtualFiles).find(f => f.toLowerCase() === asmName.toLowerCase() || f.split('/').pop().toLowerCase() === asmName.toLowerCase());
        if (isCompiled && matchedFile) {
          response.push({ type: 'info', text: 'Turbo Link  Version 3.0  Copyright (c) 1987, 1990 Borland International' });
          const targetCode = virtualFiles[matchedFile];
          const isCom = /org\s+100h/i.test(targetCode);
          const ext = isCom ? `${baseName}.com` : `${baseName}.exe`;
          setExeName(ext);
          setIsLinked(true);
          response.push({ type: 'info', text: `Linking file:      ${arg1.toUpperCase()}` });
          response.push({ type: 'warning', text: 'Warning: No stack segment' });
          response.push({ type: 'info', text: `Output file:       ${ext.toUpperCase()}` });
        } else {
          response = [{ type: 'error', text: `tlink: ${args[1]}: File not found` }];
        }
      }
    } else {
      const cleanCmd = cmd.replace('./', '');
      const baseName = cleanCmd.replace(/\.(exe|com)$/, '');
      const asmName = baseName + '.asm';
      const matchedFile = Object.keys(virtualFiles).find(f => f.toLowerCase() === asmName.toLowerCase() || f.split('/').pop().toLowerCase() === asmName.toLowerCase());
      
      if (isLinked && cleanCmd === exeName && matchedFile) {
        response.push({ type: 'info', text: `Executing ${cleanCmd.toUpperCase()}...` });
        try {
          const targetCode = virtualFiles[matchedFile];
          emulatorRef.current.load(targetCode);
          const output = emulatorRef.current.run();
          
          output.forEach(line => {
            response.push({ type: 'success', text: line });
          });

          setEmulatorState({
            registers: { ...emulatorRef.current.registers },
            flags: { ...emulatorRef.current.flags },
            ip: emulatorRef.current.ip,
            memory: [...emulatorRef.current.memory],
            output: [...output],
            running: false,
          });

          response.push({ type: 'info', text: 'Program terminated successfully.' });
        } catch (err) {
          response.push({ type: 'error', text: `Runtime Error: ${err.message}` });
        }
      } else {
        response = [{ type: 'error', text: `bash: ${cmd}: command not found` }];
      }
    }

    setTerminalHistory([...newHistory, ...response]);
  };

  const handleTerminalKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex < commandHistory.length) {
        setHistoryIndex(nextIndex);
        setTerminalInput(commandHistory[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = historyIndex - 1;
      if (nextIndex >= 0) {
        setHistoryIndex(nextIndex);
        setTerminalInput(commandHistory[nextIndex]);
      } else {
        setHistoryIndex(-1);
        setTerminalInput('');
      }
    }
  };

  const searchResults = searchQuery ? searchInstructions(searchQuery) : [];

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      <div className={`app-final ${!showSplash ? 'revealed' : ''} ${mobileView ? 'mobile' : 'desktop'} ${isDragging ? 'dragging' : ''}`}>
      {/* Header */}
      <header className="header-final">
        <div className="header-brand">
          <div className="brand-title-group">
            <h1>{mobileView ? '⚙️ Renance' : '⚙️ Renance Playground'}</h1>
            <span className="by-resolute-femi">by Resolute Femi</span>
          </div>
          {!mobileView && <span className="badge">8086 Full ISA</span>}
        </div>

        <div className="header-controls">
          <button
            className={`btn btn-outline ${fileExplorerOpen ? 'active' : ''}`}
            onClick={() => setFileExplorerOpen(!fileExplorerOpen)}
            title="Toggle File Explorer"
          >
            {mobileView ? '📁' : '📁 Files'}
          </button>
          <select 
            className="select-template-final" 
            onChange={(e) => {
              const selected = e.target.value;
              let targetCode = '';
              if (selected === 'hello') {
                targetCode = `.MODEL SMALL\n.STACK 100H\n.DATA\n    MSG DB 'How are you doing$'\n.CODE\nMAIN PROC\n    MOV AX, @DATA\n    MOV DS, AX\n    LEA DX, MSG\n    MOV AH, 09H\n    INT 21H\n    MOV AH, 4CH\n    INT 21H\nMAIN ENDP\nEND MAIN`;
              } else if (selected === 'fib') {
                targetCode = `; Fibonacci Sequence\n; Generates first 10 Fibonacci numbers\n; Stores them in memory starting at 0x0200\n\nORG 200H\n\nMOV CX, 10\nMOV SI, 0x200\n\nMOV AL, 0\nMOV [SI], AL\nINC SI\n\nMOV BL, 1\nMOV [SI], BL\nINC SI\n\nSUB CX, 2\n\nfib_loop:\n    ADD AL, BL\n    MOV [SI], AL\n    INC SI\n    MOV DL, BL\n    MOV BL, AL\n    MOV AL, DL\n    LOOP fib_loop\n\nHLT`;
              } else if (selected === 'loop') {
                targetCode = `; Loop Counter Example\nMOV CX, 10\nMOV AX, 0\n\ncount_loop:\n    ADD AX, CX\n    LOOP count_loop\n\nHLT`;
              } else if (selected === 'math') {
                targetCode = `; Basic Arithmetic and Flags\nMOV AX, 0x50\nMOV BX, 0x20\nADD AX, BX         ; AX = 0x70\n\nSUB AX, 0x70       ; AX = 0, Zero Flag (ZF) is set\n\nMOV CX, 0xFFFF\nINC CX             ; CX = 0 (ZF, CF set)\n\nHLT`;
              } else if (selected === 'calc') {
                targetCode = `; Simple Calculator Simulation\n; Set inputs in AL and BL, operator in CL:\n; CL = 1 (Add), CL = 2 (Subtract), CL = 3 (XOR)\nMOV AL, 15         ; Input 1\nMOV BL, 7          ; Input 2\nMOV CL, 1          ; Operator (1 = Add)\n\nCMP CL, 1\nJE DO_ADD\nCMP CL, 2\nJE DO_SUB\nCMP CL, 3\nJE DO_XOR\nJMP CALC_DONE\n\nDO_ADD:\n    ADD AL, BL     ; Result in AL\n    JMP CALC_DONE\n\nDO_SUB:\n    SUB AL, BL     ; Result in AL\n    JMP CALC_DONE\n\nDO_XOR:\n    XOR AL, BL     ; Result in AL\n\nCALC_DONE:\n    HLT`;
              } else if (selected === 'sort') {
                targetCode = `; Array Bubble Sort Example\n; Sorts 5 bytes in memory starting at 0x200\n\nORG 200H\n\n; Setup array elements in memory\nMOV BX, 0x200\nMOV BYTE [BX], 5\nMOV BYTE [BX+1], 2\nMOV BYTE [BX+2], 8\nMOV BYTE [BX+3], 1\nMOV BYTE [BX+4], 4\n\nMOV CX, 5          ; N = 5\n\nouter_loop:\n    DEC CX             ; N - 1 passes\n    JZ sort_done\n    \n    MOV SI, 0x200      ; Start of array\n    MOV DX, CX         ; Inner loop counter\n\ninner_loop:\n    MOV AL, [SI]       ; Load current element\n    MOV BL, [SI+1]     ; Load next element\n    CMP AL, BL\n    JBE no_swap        ; If AL <= BL, no swap\n    \n    ; Swap elements\n    MOV [SI], BL\n    MOV [SI+1], AL\n\nno_swap:\n    INC SI             ; Move to next element\n    DEC DX\n    JNZ inner_loop\n    JMP outer_loop\n\nsort_done:\n    HLT`;
              }
              if (targetCode) {
                setCode(targetCode);
                setVirtualFiles(prev => ({
                  ...prev,
                  [activeFile]: targetCode
                }));
              }
              resetCode();
            }}
            defaultValue=""
          >
            <option value="" disabled>{mobileView ? '📂 Examples' : '📂 Load Example...'}</option>
            <option value="hello">Hello World (Print String)</option>
            <option value="fib">Fibonacci Sequence (Memory Store)</option>
            <option value="loop">Loop Counter</option>
            <option value="math">Arithmetic & Flags</option>
            <option value="calc">Simple Calculator</option>
            <option value="sort">Bubble Sort Array (0x200)</option>
          </select>
          <button className="btn btn-primary btn-run" onClick={runCode} title="Run Code (F5)">
            {mobileView ? '▶' : '▶ Run'}
          </button>
          <button className="btn btn-warning btn-step" onClick={stepCode} title="Step Debug (F10)">
            {mobileView ? '🐾' : '🐾 Step'}
          </button>
          <button className="btn btn-secondary btn-reset" onClick={resetCode} title="Reset CPU">
            {mobileView ? '🔄' : '🔄 Reset'}
          </button>
          <button className="btn btn-info btn-export" onClick={downloadAsmFile} title="Export Code as .ASM">
            {mobileView ? '📥' : '📥 Export'}
          </button>
          <button className="btn btn-danger btn-clear" onClick={clearCode} title="Clear All">
            {mobileView ? '🗑' : '🗑 Clear'}
          </button>
          {!mobileView && (
            <>
              <button
                className={`btn btn-info ${showReference ? 'active' : ''}`}
                onClick={() => setShowReference(!showReference)}
                title="Toggle Reference"
              >
                📚 Reference
              </button>
              <button
                className={`btn btn-outline ${terminalOpen ? 'active' : ''}`}
                onClick={() => setTerminalOpen(!terminalOpen)}
                title="Toggle Terminal"
              >
                💻 Terminal
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Sidebar File Explorer */}
        {fileExplorerOpen && (
          <div className="sidebar-explorer">
            <div className="explorer-header">
              <span className="explorer-title">📁 Workspace</span>
              <div className="explorer-actions">
                <button className="explorer-action-btn" onClick={triggerCreateFile} title="New File">📄+</button>
                <button className="explorer-action-btn" onClick={triggerCreateFolder} title="New Folder">📁+</button>
              </div>
            </div>
            
            <div className="explorer-tree">
              {/* Inline Folder Creation Input */}
              {isCreatingFolder && (
                <div className="tree-folder-group editing">
                  <div className="tree-folder-header">
                    <span className="tree-icon">📁</span>
                    <input
                      type="text"
                      className="inline-explorer-input"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={(e) => handleInlineInputKeyDown(e, 'folder')}
                      onBlur={(e) => {
                        const val = e.target.value;
                        setTimeout(() => handleNewFolderSubmit(val), 150);
                      }}
                      autoFocus
                      placeholder="New folder..."
                    />
                  </div>
                </div>
              )}

              {/* Folders & Files tree */}
              {Object.entries(getFileTree().folders).map(([folderName, files]) => (
                <div key={folderName} className="tree-folder-group">
                  <div className="tree-folder-header">
                    <span className="tree-icon">📁</span>
                    <span className="tree-name">{folderName}</span>
                    <button 
                      className="tree-item-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFolder(folderName);
                      }}
                      title="Delete Folder"
                    >
                      🗑
                    </button>
                  </div>
                  <div className="tree-folder-children">
                    {files.map(file => (
                      <div
                        key={file.path}
                        className={`tree-file-item ${activeFile === file.path ? 'active' : ''}`}
                        onClick={() => selectActiveFile(file.path)}
                      >
                        <span className="tree-icon">📄</span>
                        <span className="tree-name">{file.name}</span>
                        <button 
                          className="tree-item-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFile(file.path);
                          }}
                          title="Delete File"
                        >
                          🗑
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {/* Inline File Creation Input */}
              {isCreatingFile && (
                <div className="tree-file-item root-file editing">
                  <span className="tree-icon">📄</span>
                  <input
                    type="text"
                    className="inline-explorer-input"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => handleInlineInputKeyDown(e, 'file')}
                    onBlur={(e) => {
                      const val = e.target.value;
                      setTimeout(() => handleNewFileSubmit(val), 150);
                    }}
                    autoFocus
                    placeholder="new_file.asm..."
                  />
                </div>
              )}

              {/* Root Files */}
              {getFileTree().rootFiles.map(file => (
                <div
                  key={file.path}
                  className={`tree-file-item root-file ${activeFile === file.path ? 'active' : ''}`}
                  onClick={() => selectActiveFile(file.path)}
                >
                  <span className="tree-icon">📄</span>
                  <span className="tree-name">{file.name}</span>
                  <button 
                    className="tree-item-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFile(file.path);
                    }}
                    title="Delete File"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Editor Panel */}
        <div className="editor-panel">
          <div className="panel-header">
            <span className="panel-title">📝 Code Editor {activeFile ? `(${activeFile})` : ''}</span>
            <span className="auto-save-indicator">💾 Auto-saving...</span>
          </div>

          <CodeMirror
            value={code}
            onChange={(val) => {
              setCode(val);
              setVirtualFiles(prev => ({
                ...prev,
                [activeFile]: val
              }));
            }}
            theme={darcula}
            extensions={[asmHighlightPlugin]}
            height="100%"
            width="100%"
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              foldGutter: true,
              dropCursor: true,
              indentOnInput: true,
              lineNumberFormatter: (line) => `${line}`,
            }}
            className="code-editor-final"
          />
        </div>

        {/* Right Section */}
        <div className={`right-section ${showReference ? 'show-ref' : 'hide-ref'}`}>
          {/* CPU State */}
          <div className={`cpu-panel ${!showReference ? 'full-width' : ''}`}>
            <div className="cpu-tabs">
              <button
                className={`tab ${activeTab === 'cpu' ? 'active' : ''}`}
                onClick={() => setActiveTab('cpu')}
              >
                💻 CPU State
              </button>
              <button
                className={`tab ${activeTab === 'memory' ? 'active' : ''}`}
                onClick={() => setActiveTab('memory')}
              >
                💾 Memory
              </button>
              <button
                className={`tab ${activeTab === 'output' ? 'active' : ''}`}
                onClick={() => setActiveTab('output')}
              >
                📊 Output
              </button>
            </div>

            <div className="cpu-content">
              {activeTab === 'cpu' && (
                <div className="cpu-details">
                  <div className="registers-group">
                    <h4>📌 General Registers (16-bit)</h4>
                    <div className="register-grid">
                      {['ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp', 'sp'].map(reg => (
                        <div key={reg} className="register-item">
                          <span className="reg-label">{reg.toUpperCase()}</span>
                          <span className="reg-hex">0x{(emulatorState.registers[reg] || 0).toString(16).toUpperCase().padStart(4, '0')}</span>
                          <span className="reg-dec">{emulatorState.registers[reg] || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="registers-group">
                    <h4>📌 Segment Registers</h4>
                    <div className="register-grid">
                      {['cs', 'ds', 'ss', 'es'].map(reg => (
                        <div key={reg} className="register-item">
                          <span className="reg-label">{reg.toUpperCase()}</span>
                          <span className="reg-hex">0x{(emulatorState.registers[reg] || 0).toString(16).toUpperCase().padStart(4, '0')}</span>
                          <span className="reg-dec">{emulatorState.registers[reg] || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flags-group">
                    <h4>🚩 CPU Flags</h4>
                    <div className="flags-display">
                      {Object.entries(FLAG_BITS).map(([flag, info]) => (
                        <div
                          key={flag}
                          className={`flag-item ${emulatorState.flags[flag.toLowerCase()] ? 'set' : 'clear'}`}
                          title={info.description}
                        >
                          <span className="flag-name">{flag}</span>
                          <span className="flag-val">{emulatorState.flags[flag.toLowerCase()] ? '1' : '0'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="ip-group">
                    <h4>⏩ Instruction Pointer</h4>
                    <div className="ip-display">
                      <span>IP: 0x{(emulatorState.ip || 0).toString(16).toUpperCase().padStart(4, '0')}</span>
                      <span className="ip-decimal">({emulatorState.ip || 0})</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'memory' && (
                <div className="memory-details">
                  <div className="memory-header-controls">
                    <h4>🧠 Memory Explorer</h4>
                    <div className="memory-search-box">
                      <span className="search-label">Base Address:</span>
                      <input
                        type="text"
                        placeholder="e.g. 0x0200 or 200h"
                        className="memory-search-input"
                        onChange={(e) => {
                          const val = e.target.value.trim().toLowerCase();
                          if (!val) {
                            setMemoryBaseAddress(0);
                            return;
                          }
                          let num;
                          if (val.startsWith('0x')) {
                            num = parseInt(val.slice(2), 16);
                          } else if (val.endsWith('h')) {
                            num = parseInt(val.slice(0, -1), 16);
                          } else {
                            num = parseInt(val, 10);
                          }
                          if (!isNaN(num)) {
                            setMemoryBaseAddress(Math.max(0, Math.min(65280, num & 0xFFF0)));
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="memory-grid">
                    {Array.from({ length: 16 }).map((_, row) => {
                      const rowAddr = memoryBaseAddress + row * 16;
                      return (
                        <div key={row} className="memory-row">
                          <span className="mem-addr">0x{rowAddr.toString(16).toUpperCase().padStart(4, '0')}:</span>
                          <div className="mem-bytes">
                            {Array.from({ length: 16 }).map((_, col) => (
                              <span key={col} className="mem-byte">
                                {(emulatorState.memory[rowAddr + col] || 0).toString(16).toUpperCase().padStart(2, '0')}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'output' && (
                <div className="output-details">
                  <div className="output-header">
                    <h4>Output Log</h4>
                    <button className="btn-clear-output" onClick={clearTerminal} title="Clear output">
                      ✕
                    </button>
                  </div>
                  <div className="output-log">
                    {emulatorState.output.length === 0 ? (
                      <div className="empty-output">▶ Run code to see output...</div>
                    ) : (
                      emulatorState.output.map((line, idx) => (
                        <div key={idx} className="output-line">
                          <span className="line-num">{idx + 1}.</span>
                          <span className="line-text">{line}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reference Panel */}
          {showReference && (
            <div className="reference-panel">
              <div className="ref-header">
                <h3>📚 Instruction Reference</h3>
                <input
                  type="text"
                  placeholder="Search instructions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-box"
                />
              </div>

              <div className="ref-items">
                {searchResults.length > 0 ? (
                  searchResults.slice(0, 30).map(instr => (
                    <div
                      key={instr.name}
                      className="ref-item"
                      onClick={() => insertInstruction(instr.name)}
                    >
                      <div className="item-name">{instr.name.toUpperCase()}</div>
                      <div className="item-desc">{instr.description}</div>
                      <div className="item-example">{instr.examples?.[0] || ''}</div>
                    </div>
                  ))
                ) : searchQuery ? (
                  <div className="no-results">No instructions found</div>
                ) : (
                  Object.entries(INSTRUCTION_SET).slice(0, 30).map(([name, data]) => (
                    <div
                      key={name}
                      className="ref-item"
                      onClick={() => insertInstruction(name)}
                    >
                      <div className="item-name">{name.toUpperCase()}</div>
                      <div className="item-desc">{data.description}</div>
                      <div className="item-example">{data.examples?.[0] || ''}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Terminal (Floating/Bottom) */}
      {terminalOpen && (
        <div
          className={`terminal-container ${mobileView ? 'mobile-terminal' : 'desktop-terminal'}`}
          style={!mobileView ? { height: `${terminalHeight}px` } : {}}
          ref={terminalRef}
        >
          <div
            className="terminal-handle"
            onMouseDown={handleTerminalMouseDown}
            onTouchStart={handleTerminalTouchStart}
          >
            <span className="handle-text">{'⋮⋮ Drag to Resize ⋮⋮'}</span>
          </div>

          <div className="terminal-header">
            <div className="terminal-title">
              <span className="terminal-icon">▶</span>
              <span>Terminal Output</span>
            </div>
            <div className="terminal-controls">
              <button className="term-btn" onClick={clearTerminal} title="Clear">
                Clear
              </button>
              <button className="term-btn" onClick={() => setTerminalOpen(false)} title="Close">
                ✕
              </button>
            </div>
          </div>

          <div className="terminal-body" onClick={() => document.getElementById('terminal-input-id')?.focus()}>
            {terminalHistory.map((line, idx) => {
              if (line.type === 'prompt') {
                return (
                  <div key={idx} className="terminal-line">
                    <div className="bash-prompt">
                      <span className="prompt-user">renance@playground</span>
                      <span className="prompt-symbol"> </span>
                      <span className="prompt-mingw">MINGW64</span>
                      <span className="prompt-symbol"> </span>
                      <span className="prompt-path">~/ren-asm ({/org\s+100h/i.test(code) ? 'com' : 'exe'})</span>
                      <span className="prompt-symbol"> $ </span>
                      <span>{line.text}</span>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div key={idx} className={`terminal-output-line ${line.type}`}>
                    {line.text}
                  </div>
                );
              }
            })}

            {/* Input Line */}
            <form onSubmit={handleCommandSubmit} className="terminal-input-line">
              <div className="bash-prompt">
                <span className="prompt-user">renance@playground</span>
                <span className="prompt-symbol"> </span>
                <span className="prompt-mingw">MINGW64</span>
                <span className="prompt-symbol"> </span>
                <span className="prompt-path">~/ren-asm ({/org\s+100h/i.test(code) ? 'com' : 'exe'})</span>
                <span className="prompt-symbol"> $ </span>
              </div>
              <input
                id="terminal-input-id"
                type="text"
                className="terminal-input-field"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                onKeyDown={handleTerminalKeyDown}
                autoFocus
                autoComplete="off"
              />
            </form>
          </div>
        </div>
      )}

      {/* Mobile Bottom Bar */}
      {mobileView && (
        <div className="mobile-bottom-bar">
          <button
            className={`bar-btn ${activeTab === 'cpu' ? 'active' : ''}`}
            onClick={() => setActiveTab('cpu')}
          >
            💻
          </button>
          <button
            className={`bar-btn ${activeTab === 'memory' ? 'active' : ''}`}
            onClick={() => setActiveTab('memory')}
          >
            💾
          </button>
          <button
            className={`bar-btn ${activeTab === 'output' ? 'active' : ''}`}
            onClick={() => setActiveTab('output')}
          >
            📊
          </button>
          <button
            className={`bar-btn ${showReference ? 'active' : ''}`}
            onClick={() => setShowReference(!showReference)}
          >
            📚
          </button>
          <button
            className={`bar-btn ${terminalOpen ? 'active' : ''}`}
            onClick={() => setTerminalOpen(!terminalOpen)}
          >
            💻
          </button>
        </div>
      )}

      {/* Mobile Symbol Keyboard */}
      {mobileView && !showReference && (
        <div className="mobile-keyboard">
          <div className="keyboard-grid">
            {['mov', 'add', 'sub', 'cmp', 'and', 'or', 'xor', 'jmp',
              'je', 'jne', 'loop', 'call', 'push', 'pop', 'hlt', 'nop'].map(instr => (
              <button
                key={instr}
                className="key-btn"
                onClick={() => insertInstruction(instr)}
              >
                {instr}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
    </>
  );
}

// IndexedDB Helpers
function saveToIndexedDB(key, value) {
  return new Promise((resolve) => {
    const request = indexedDB.open('RenancePlayground', 1);
    request.onsuccess = (e) => {
      const db = e.target.result;
      const store = db.transaction('code', 'readwrite').objectStore('code');
      store.put({ id: key, data: value });
      resolve();
    };
  });
}

function loadFromIndexedDB(key) {
  return new Promise((resolve) => {
    const request = indexedDB.open('RenancePlayground', 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('code', { keyPath: 'id' });
    };
    request.onsuccess = (e) => {
      const db = e.target.result;
      const store = db.transaction('code', 'readonly').objectStore('code');
      const getRequest = store.get(key);
      getRequest.onsuccess = () => resolve(getRequest.result?.data || null);
    };
  });
}
