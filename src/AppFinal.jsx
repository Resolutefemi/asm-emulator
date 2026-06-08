// src/AppFinal.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { darcula } from '@uiw/codemirror-theme-darcula';
import { Decoration, ViewPlugin } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { Emulator8086 } from './emulator/Emulator8086';
import { INSTRUCTION_SET, FLAG_BITS, searchInstructions } from './data/InstructionSet8086';
import SplashScreen from './components/SplashScreen';
import ActivityBar from './components/ActivityBar';
import WorkspaceExplorer from './components/WorkspaceExplorer';
import TemplateBrowser from './components/TemplateBrowser';
import './styles/AppFinal.css';
import './styles/ActivityBar.css';

const SAMPLE_PROJECTS = [
  {
    name: "Print Hello World",
    code: `; Print Hello World program for 8086 Assembly
org 100h

jmp start

message db 'Hello, World!$', 0Dh, 0Ah

start:
    mov dx, offset message ; Load address of message
    mov ah, 09h            ; DOS interrupt function to print string
    int 21h                ; Execute interrupt

    hlt                    ; Halt CPU
`
  },
  {
    name: "Addition of Two Numbers",
    code: `; Addition of Two Numbers (AX = AX + BX)
org 100h

mov ax, 15        ; Load first number into AX (decimal 15)
mov bx, 27        ; Load second number into BX (decimal 27)
add ax, bx        ; Add BX to AX

hlt               ; Halt CPU (AX now contains 42)
`
  },
  {
    name: "Loop Array Example",
    code: `; Loop Array Example - Summing elements of an array
org 100h

jmp start

array db 5, 10, 15, 20, 25 ; Array of 5 bytes
sum dw 0                   ; Variable to hold sum

start:
    mov cx, 5              ; Set loop counter to array length
    xor ax, ax             ; Clear AX (accumulator for sum)
    mov bx, offset array   ; Load address of array into BX

sum_loop:
    mov dl, [bx]           ; Load byte at address BX
    xor dh, dh             ; Clear high byte of DX
    add ax, dx             ; Add element to sum
    inc bx                 ; Point to next element in array
    loop sum_loop          ; Decrement CX, jump to sum_loop if CX > 0

    mov sum, ax            ; Store total sum in variable
    hlt                    ; Halt CPU
`
  },
  {
    name: "String Manipulation",
    code: `; String Manipulation - Convert string to uppercase
org 100h

jmp start

string db 'hello assembly world$', 0

start:
    mov si, offset string  ; Point SI to the start of the string

upper_loop:
    mov al, [si]           ; Get character
    cmp al, '$'            ; Check if end of string
    je done                ; If end, jump to done
    
    cmp al, 'a'            ; Compare to 'a'
    jb next_char           ; If below 'a', next char
    cmp al, 'z'            ; Compare to 'z'
    ja next_char           ; If above 'z', next char
    
    sub al, 32             ; Convert lowercase to uppercase
    mov [si], al           ; Store it back

next_char:
    inc si                 ; Move to next char
    jmp upper_loop         ; Repeat

done:
    mov dx, offset string  ; Load address of modified string
    mov ah, 09h            ; DOS print service
    int 21h                ; Print string

    hlt                    ; Halt CPU
`
  }
];

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
  const [workspacePath, setWorkspacePath] = useState(null);
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);
  const [rightMenuOpen, setRightMenuOpen] = useState(false);
  const [activeMobileModal, setActiveMobileModal] = useState(null); // null | 'cpu' | 'memory' | 'output' | 'reference'
  const rightMenuRef = useRef(null);
  const [terminalMaximized, setTerminalMaximized] = useState(false);
  const [customDialog, setCustomDialog] = useState(null); // null or { type, title, message, defaultValue, onConfirm, onCancel }

  const [samplesDropdownOpen, setSamplesDropdownOpen] = useState(false);
  const samplesMenuRef = useRef(null);
  const [mobileExplorerOpen, setMobileExplorerOpen] = useState(false);

  // ── Activity Bar state ──
  const [activityTab, setActivityTab] = useState(window.innerWidth < 768 ? null : 'explorer'); // null | 'explorer' | 'templates'
  const [wsDir, setWsDir] = useState(null);             // opened folder name
  const [wsFiles, setWsFiles] = useState([]);            // { name, handle }[]
  const [wsActiveFile, setWsActiveFile] = useState(null);

  // ── Native File System Access API State ──
  const [rootHandle, setRootHandle] = useState(null);
  const [selectedDirectoryHandle, setSelectedDirectoryHandle] = useState(null);
  const [activeSelectedPath, setActiveSelectedPath] = useState('');
  const [directoryHandles, setDirectoryHandles] = useState({});
  const [expandedFolders, setExpandedFolders] = useState({});

  const emulatorRef = useRef(new Emulator8086());
  const autoSaveTimerRef = useRef(null);
  const terminalRef = useRef(null);
  const dragStartY = useRef(0);

  const readDirectoryGenerator = async function* (dirHandle, currentPath = '') {
    for await (const entry of dirHandle.values()) {
      const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      if (entry.kind === 'directory') {
        const children = [];
        for await (const child of readDirectoryGenerator(entry, entryPath)) {
          children.push(child);
        }
        yield {
          name: entry.name,
          kind: 'directory',
          type: 'folder',
          children: children,
          isOpen: false,
          path: entryPath,
          handle: entry
        };
      } else if (entry.name.endsWith('.asm') || entry.name.endsWith('.md') || entry.name.endsWith('.txt')) {
        yield {
          name: entry.name,
          kind: 'file',
          type: 'file',
          path: entryPath,
          handle: entry
        };
      }
    }
  };

  const buildNativeTree = async (dirHandle, currentPath = '') => {
    const nodes = [];
    for await (const node of readDirectoryGenerator(dirHandle, currentPath)) {
      nodes.push(node);
    }
    return nodes;
  };

  const showAlert = (title, message) => {
    return new Promise((resolve) => {
      setCustomDialog({
        type: 'alert',
        title,
        message,
        onConfirm: () => {
          setCustomDialog(null);
          resolve();
        }
      });
    });
  };

  const showConfirm = (title, message) => {
    return new Promise((resolve) => {
      setCustomDialog({
        type: 'confirm',
        title,
        message,
        onConfirm: () => {
          setCustomDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setCustomDialog(null);
          resolve(false);
        }
      });
    });
  };

  const showPrompt = (title, message, defaultValue = '') => {
    return new Promise((resolve) => {
      setCustomDialog({
        type: 'prompt',
        title,
        message,
        defaultValue,
        onConfirm: (val) => {
          setCustomDialog(null);
          resolve(val);
        },
        onCancel: () => {
          setCustomDialog(null);
          resolve(null);
        }
      });
    });
  };

  // Workspace logic
  const refreshWorkspace = async () => {
    if (rootHandle) {
      try {
        const newFiles = {};
        const handlesMap = {};
        handlesMap['root'] = rootHandle;
        
        const processHandle = async (dirHandle, parentPath = '') => {
          for await (const entry of dirHandle.values()) {
            const relPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
            if (entry.kind === 'directory') {
              handlesMap[relPath] = entry;
              await processHandle(entry, relPath);
            } else {
              newFiles[relPath] = virtualFiles[relPath] || ''; // Preserve loaded content
            }
          }
        };
        
        await processHandle(rootHandle);
        const newTree = await buildNativeTree(rootHandle);
        
        // Preserve isOpen state by mapping old wsFiles to newTree if needed, or simply let the state refresh if this is a hard reload.
        setDirectoryHandles(handlesMap);
        setVirtualFiles(newFiles);
        setWsFiles(newTree);
        
        // Context Tracking fallback
        if (selectedDirectoryHandle && !Object.values(handlesMap).includes(selectedDirectoryHandle)) {
           setSelectedDirectoryHandle(rootHandle);
        }
      } catch (err) {
        console.error('Failed to refresh workspace natively:', err);
      }
    } else if (workspacePath && window.__TAURI__) {
      try {
        const entries = await window.__TAURI__.fs.readDir(workspacePath, { recursive: true });
        const newFiles = {};
        const processEntries = (items, parent = '') => {
          items.forEach(item => {
            const relPath = parent ? `${parent}/${item.name}` : item.name;
            if (item.children) {
              processEntries(item.children, relPath);
            } else {
              newFiles[relPath] = virtualFiles[relPath] || '';
            }
          });
        };
        processEntries(entries);
        setVirtualFiles(newFiles);
      } catch (err) {
        console.error('Failed to refresh workspace:', err);
      }
    }
  };

  const openWorkspace = async () => {
    if (window.showDirectoryPicker) {
      try {
        const handle = await window.showDirectoryPicker();
        setRootHandle(handle);
        setSelectedDirectoryHandle(handle); // Context Tracking: Default to root handle
        setWorkspacePath(handle.name);
        
        const newFiles = {};
        const handlesMap = {};
        handlesMap['root'] = handle;

        const processHandle = async (dirHandle, parentPath = '') => {
          for await (const entry of dirHandle.values()) {
            const relPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
            if (entry.kind === 'directory') {
              handlesMap[relPath] = entry;
              await processHandle(entry, relPath);
            } else {
              newFiles[relPath] = ''; // Content loaded on demand
            }
          }
        };
        
        await processHandle(handle);
        const newTree = await buildNativeTree(handle);
        
        setDirectoryHandles(handlesMap);
        setVirtualFiles(newFiles);
        setWsFiles(newTree);
        
        const firstAsm = Object.keys(newFiles).find(f => f.endsWith('.asm'));
        if (firstAsm) {
          try {
            const fileHandle = await handle.getFileHandle(firstAsm);
            const file = await fileHandle.getFile();
            const text = await file.text();
            setActiveFile(firstAsm);
            setCode(text);
            setVirtualFiles(prev => ({ ...prev, [firstAsm]: text }));
          } catch (e) {
            console.error('Failed to load first native file', e);
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Failed to open workspace natively:', err);
      }
    } else if (window.__TAURI__) {
      try {
        const selected = await window.__TAURI__.dialog.open({
          directory: true,
          multiple: false,
          title: 'Select Workspace Folder'
        });
        if (selected) {
          setWorkspacePath(selected);
          const entries = await window.__TAURI__.fs.readDir(selected, { recursive: true });
          const newFiles = {};
          const processEntries = (items, parent = '') => {
            items.forEach(item => {
              const relPath = parent ? `${parent}/${item.name}` : item.name;
              if (item.children) {
                processEntries(item.children, relPath);
              } else {
                newFiles[relPath] = '';
              }
            });
          };
          processEntries(entries);
          setVirtualFiles(newFiles);
          
          const firstAsm = Object.keys(newFiles).find(f => f.endsWith('.asm'));
          if (firstAsm) {
            setActiveFile(firstAsm);
            const content = await window.__TAURI__.fs.readTextFile(`${selected}/${firstAsm}`);
            setCode(content);
          }
        }
      } catch (err) {
        console.error('Failed to open workspace:', err);
      }
    } else {
      // Fallback for web demo
      setWorkspacePath('/virtual/workspace');
    }
  };

  const handleRename = async (oldPath, newName) => {
    if (!newName || oldPath.endsWith(newName)) return;
    
    const parts = oldPath.split('/');
    parts[parts.length - 1] = newName;
    const newPath = parts.join('/');

    if (workspacePath && window.__TAURI__) {
      try {
        await window.__TAURI__.fs.renameFile(`${workspacePath}/${oldPath}`, `${workspacePath}/${newPath}`);
      } catch (err) {
        showAlert('Rename Failed', `Failed to rename: ${err.message}`);
        return;
      }
    }

    setVirtualFiles(prev => {
      const copy = { ...prev };
      copy[newPath] = copy[oldPath];
      delete copy[oldPath];
      return copy;
    });

    if (activeFile === oldPath) {
      setActiveFile(newPath);
    }
  };

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
  const [isDirty, setIsDirty] = useState(false);
  const [showRunDropdown, setShowRunDropdown] = useState(false);

  // Handle manual file save
  const handleSave = async () => {
    if (!activeFile) return;
    
    if (workspacePath && window.__TAURI__) {
      try {
        await window.__TAURI__.fs.writeTextFile(`${workspacePath}/${activeFile}`, code);
        setIsDirty(false);
        setTerminalHistory(prev => [
          ...prev,
          { type: 'info', text: `✔ Saved: ${activeFile}` }
        ]);
      } catch (err) {
        console.error('Failed to save to disk:', err);
        showAlert('Save Failed', `Save failed: ${err.message}`);
      }
    } else {
      // Fallback/Web VFS save
      setVirtualFiles(prev => ({
        ...prev,
        [activeFile]: code
      }));
      setIsDirty(false);
    }
  };

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
      
      // Control + S to Save
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
      
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
  }, [code, isCompiled, isLinked, activeFile, workspacePath]);

  // Unsaved changes guard
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ''; // Standard browser requirement for confirmation modal
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Mobile menu click outside handler
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (mobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [mobileMenuOpen]);

  // Right menu click outside handler
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (rightMenuOpen && rightMenuRef.current && !rightMenuRef.current.contains(e.target)) {
        setRightMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [rightMenuOpen]);

  // Samples dropdown click outside handler
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (samplesDropdownOpen && samplesMenuRef.current && !samplesMenuRef.current.contains(e.target)) {
        setSamplesDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [samplesDropdownOpen]);

  const downloadAsmFile = () => {
    const element = document.createElement("a");
    const file = new Blob([code], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = "program.asm";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const addNodeToTree = (treeNodes, parentPath, newNode) => {
    return treeNodes.map(node => {
      if (node.kind === 'directory') {
        if (node.path === parentPath) {
          return {
            ...node,
            children: [...node.children, newNode],
            isOpen: true
          };
        } else if (node.children) {
          return {
            ...node,
            children: addNodeToTree(node.children, parentPath, newNode)
          };
        }
      }
      return node;
    });
  };

  const renderTree = (items, depth = 0) => {
    if (!Array.isArray(items)) return null;

    const sortedItems = [...items].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    if (sortedItems.length === 0 && depth === 0 && workspacePath) {
      return (
        <div className="empty-tree-message">
          <p>Your workspace is empty.</p>
          <button className="btn btn-outline btn-small" onClick={triggerCreateFile}>
            📄 Create your first file
          </button>
        </div>
      );
    }

    return sortedItems.map(item => {
      if (item.kind === 'directory' || item.type === 'folder') {
        const isExpanded = item.isOpen;
        return (
          <div key={item.path || item.name} className="tree-folder-group">
            <div 
              className={`tree-folder-header ${item.path === activeSelectedPath ? 'active-target' : ''}`}
              style={{ 
                paddingLeft: `${depth * 12 + 14}px`,
                background: item.path === activeSelectedPath ? '#2d333b' : 'transparent',
                borderLeft: item.path === activeSelectedPath ? '3px solid #58a6ff' : '3px solid transparent',
                color: item.path === activeSelectedPath ? '#ffffff' : 'inherit'
              }}
              onClick={async (e) => {
                e.stopPropagation();
                setActiveSelectedPath(item.path);
                if (item.handle) {
                  setSelectedDirectoryHandle(item.handle);
                }
                const isNowOpen = !item.isOpen;
                let newChildren = item.children;
                if (isNowOpen && item.handle) {
                  newChildren = [];
                  for await (const node of readDirectoryGenerator(item.handle, item.path)) {
                    newChildren.push(node);
                  }
                }
                const toggleNode = (nodes) => nodes.map(n => {
                  if (n.path === item.path) return { ...n, isOpen: isNowOpen, children: newChildren };
                  if (n.children) return { ...n, children: toggleNode(n.children) };
                  return n;
                });
                setWsFiles(toggleNode(wsFiles));
              }}
            >
              <span className="tree-icon">📁</span>
              <span className="tree-name">{item.name}</span>
              <div className="tree-item-actions">
                <button 
                  className="tree-item-action-btn"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const newName = await showPrompt('Rename Folder', 'Enter new folder name:', item.name);
                    if (newName) handleRename(item.name, newName);
                  }}
                  title="Rename Folder"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button 
                  className="tree-item-action-btn delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFolder(item.name);
                  }}
                  title="Delete Folder"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </div>
            {isExpanded && (
              <div className="tree-folder-children">
                {renderTree(item, depth + 1)}
              </div>
            )}
          </div>
        );
      } else {
        return (
          <div
            key={item.path}
            className={`tree-file-item ${item.path === activeSelectedPath ? 'active-target active' : (activeFile === item.path ? 'active' : '')}`}
            style={{ 
              paddingLeft: `${depth * 12 + 14}px`,
              background: item.path === activeSelectedPath ? '#2d333b' : 'transparent',
              borderLeft: item.path === activeSelectedPath ? '3px solid #58a6ff' : '3px solid transparent',
              color: item.path === activeSelectedPath ? '#ffffff' : 'inherit'
            }}
            onClick={(e) => {
              e.stopPropagation();
              setActiveSelectedPath(item.path);
              selectActiveFile(item.path);
            }}
          >
            <span className="tree-icon">📄</span>
            <span className="tree-name">{item.name}</span>
            <div className="tree-item-actions">
              <button 
                className="tree-item-action-btn"
                onClick={async (e) => {
                  e.stopPropagation();
                  const newName = await showPrompt('Rename File', 'Enter new file name:', item.name);
                  if (newName) handleRename(item.path, newName);
                }}
                title="Rename File"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button 
                className="tree-item-action-btn delete"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFile(item.path);
                }}
                title="Delete File"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        );
      }
    });
  };

  const selectActiveFile = async (filepath) => {
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
      
      // Also save to disk if workspace is open
      if (workspacePath && window.__TAURI__) {
        try {
          await window.__TAURI__.fs.writeTextFile(`${workspacePath}/${activeFile}`, code);
        } catch (err) {
          console.error('Failed to save file to disk:', err);
        }
      }
    }

    // 2. Load code from disk if in workspace
    let fileContent = virtualFiles[filepath] || '';
    if (workspacePath && window.__TAURI__) {
      try {
        fileContent = await window.__TAURI__.fs.readTextFile(`${workspacePath}/${filepath}`);
      } catch (err) {
        console.error('Failed to read file from disk:', err);
      }
    }

    // 3. Set new active file and load code
    setActiveFile(filepath);
    setCode(fileContent);
    setVirtualFiles(prev => ({
      ...prev,
      [filepath]: fileContent
    }));
    
    // Auto-close mobile explorer overlay
    setMobileExplorerOpen(false);
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

  const handleNewFileSubmit = async (val) => {
    const filename = (val !== undefined ? val : newItemName).trim();
    if (!filename) {
      setIsCreatingFile(false);
      return;
    }

    const defaultContent = "; New assembly file\n";
    const targetDir = selectedDirectoryHandle || rootHandle;

    if (targetDir) {
      try {
        const newFileHandle = await targetDir.getFileHandle(filename, { create: true });
        const writable = await newFileHandle.createWritable();
        await writable.write(defaultContent);
        await writable.close();

        const parentPath = Object.keys(directoryHandles).find(k => directoryHandles[k] === targetDir);
        const newFullPath = parentPath && parentPath !== 'root' ? `${parentPath}/${filename}` : filename;
        
        // Automated Tree State Synchronization
        const newRootChildren = [];
        for await (const node of readDirectoryGenerator(rootHandle)) {
          newRootChildren.push(node);
        }

        const mergeState = (newNodes, oldNodes) => {
          return newNodes.map(newNode => {
            if (newNode.kind === 'directory' || newNode.type === 'folder') {
              const oldNode = oldNodes?.find(n => n.path === newNode.path);
              const isTargetParent = newNode.path === parentPath || (parentPath === 'root' && !newNode.path);
              const shouldBeOpen = isTargetParent || (oldNode ? oldNode.isOpen : false);
              return {
                ...newNode,
                isOpen: shouldBeOpen,
                children: mergeState(newNode.children || [], oldNode?.children || [])
              };
            }
            return newNode;
          });
        };
        
        const updatedTree = mergeState(newRootChildren, wsFiles);
        setWsFiles(updatedTree);
        
        setVirtualFiles(prev => ({
          ...prev,
          [newFullPath]: defaultContent
        }));
        setActiveFile(newFullPath);
        setCode(defaultContent);

      } catch (err) {
        console.error('Failed to create file on disk:', err);
        showAlert('Error', `Failed to create file: ${err.message}`);
      }
    } else {
      if (workspacePath && window.__TAURI__) {
        try {
          await window.__TAURI__.fs.writeTextFile(`${workspacePath}/${filename}`, defaultContent);
        } catch (err) {
          console.error('Failed to create file on disk:', err);
        }
      } else if (virtualFiles[filename] !== undefined) {
        showAlert('Error', "File already exists!");
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
      setVirtualFiles(prev => ({ ...prev, [filename]: defaultContent }));
      setActiveFile(filename);
      setCode(defaultContent);
    }
    
    setIsCreatingFile(false);
    setNewItemName('');
  };

  const handleNewFolderSubmit = async (val) => {
    const foldername = (val !== undefined ? val : newItemName).trim();
    if (!foldername) {
      setIsCreatingFolder(false);
      return;
    }

    const targetDir = selectedDirectoryHandle || rootHandle;
    if (targetDir) {
      try {
        const newlyCreatedDirectoryHandle = await targetDir.getDirectoryHandle(foldername, { create: true });
        
        const parentPath = Object.keys(directoryHandles).find(k => directoryHandles[k] === targetDir);
        const newFullPath = parentPath && parentPath !== 'root' ? `${parentPath}/${foldername}` : foldername;
        
        // Automated Tree State Synchronization
        const newRootChildren = [];
        for await (const node of readDirectoryGenerator(rootHandle)) {
          newRootChildren.push(node);
        }

        const mergeState = (newNodes, oldNodes) => {
          return newNodes.map(newNode => {
            if (newNode.kind === 'directory' || newNode.type === 'folder') {
              const oldNode = oldNodes?.find(n => n.path === newNode.path);
              const isTargetParent = newNode.path === parentPath || (parentPath === 'root' && !newNode.path);
              const shouldBeOpen = isTargetParent || (oldNode ? oldNode.isOpen : false);
              return {
                ...newNode,
                isOpen: shouldBeOpen,
                children: mergeState(newNode.children || [], oldNode?.children || [])
              };
            }
            return newNode;
          });
        };
        
        const updatedTree = mergeState(newRootChildren, wsFiles);
        setWsFiles(updatedTree);
        setDirectoryHandles(prev => ({ ...prev, [newFullPath]: newlyCreatedDirectoryHandle }));
        
      } catch (err) {
        console.error('Failed to create folder on disk:', err);
        showAlert('Error', `Failed to create folder: ${err.message}`);
      }
    } else {
      if (virtualDirs.includes(foldername)) {
        showAlert('Error', "Folder already exists!");
      } else {
        setVirtualDirs(prev => [...prev, foldername]);
      }
    }
    
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

  const deleteFile = async (filepath) => {
    const confirmed = await showConfirm('Delete File', `Are you sure you want to delete '${filepath}'?`);
    if (!confirmed) return;
    
    if (workspacePath && window.__TAURI__) {
      try {
        await window.__TAURI__.fs.removeFile(`${workspacePath}/${filepath}`);
      } catch (err) {
        console.error('Failed to delete file from disk:', err);
      }
    }

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

  const deleteFolder = async (folderName) => {
    const confirmed = await showConfirm('Delete Folder', `Are you sure you want to delete folder '${folderName}' and all its contents?`);
    if (!confirmed) return;
    
    if (workspacePath && window.__TAURI__) {
      try {
        await window.__TAURI__.fs.removeDir(`${workspacePath}/${folderName}`, { recursive: true });
      } catch (err) {
        console.error('Failed to delete folder from disk:', err);
      }
    }

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
      <div className={`app-final ${(!showSplash) ? 'revealed' : ''} ${mobileView ? 'mobile' : 'desktop'} ${isDragging ? 'dragging' : ''}`}>
      {/* Main Content */}
      <div className="main-content">
        {/* ── Activity Bar: 48px, desktop only ── */}
        <ActivityBar activeTab={activityTab} onTabChange={setActivityTab} />

        {/* ── Primary Sidebar: swaps content on tab change ── */}
        <div className={`primary-sidebar${activityTab ? '' : ' sidebar-hidden'}`}>
          {activityTab === 'explorer' && (
            <div className="sidebar-explorer sidebar-explorer--inline">
              {!workspacePath ? (
                <div className="ws-no-folder" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <div className="ws-no-folder-inner">
                    <p className="ws-no-folder-heading" style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '16px' }}>NO FOLDER OPENED</p>
                    <p className="ws-no-folder-sub" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>You have not yet opened a folder.</p>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', marginBottom: '16px', padding: '6px 12px' }}
                      onClick={openWorkspace}
                    >
                      Open Folder
                    </button>
                    <p className="ws-no-folder-hint" style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, opacity: 0.8 }}>
                      Opening a folder will close all currently open editors. To keep them open, add a folder instead.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="explorer-header">
                    <span className="explorer-title" title={workspacePath}>
                      {workspacePath ? workspacePath.split(/[\/\\]/).pop() : 'EXPLORER'}
                    </span>
                    <div className="explorer-actions">
                      <button className="explorer-action-btn" onClick={refreshWorkspace} title="Refresh">🔄</button>
                      <button className="explorer-action-btn" onClick={triggerCreateFile} title="New File">📄+</button>
                      <button className="explorer-action-btn" onClick={triggerCreateFolder} title="New Folder">📁+</button>
                      {workspacePath && (
                        <button className="explorer-action-btn" onClick={() => {
                          setWorkspacePath(null);
                          setRootHandle(null);
                          setSelectedDirectoryHandle(null);
                          setDirectoryHandles({});
                          setVirtualFiles({});
                        }} title="Close Workspace">✕</button>
                      )}
                    </div>
                  </div>
                  <div className="explorer-tree">
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
                        onBlur={(e) => { const val = e.target.value; setTimeout(() => handleNewFolderSubmit(val), 150); }}
                        autoFocus
                        placeholder="New folder..."
                      />
                    </div>
                  </div>
                )}
                {renderTree(wsFiles)}
                {isCreatingFile && (
                  <div className="tree-file-item root-file editing">
                    <span className="tree-icon">📄</span>
                    <input
                      type="text"
                      className="inline-explorer-input"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={(e) => handleInlineInputKeyDown(e, 'file')}
                      onBlur={(e) => { const val = e.target.value; setTimeout(() => handleNewFileSubmit(val), 150); }}
                      autoFocus
                      placeholder="new_file.asm..."
                    />
                  </div>
                )}
              </div>
              </>
              )}
            </div>
          )}
          {activityTab === 'templates' && (
            <TemplateBrowser onInsertTemplate={(tmplCode) => setCode(tmplCode)} />
          )}
        </div>

        {/* Editor Panel */}
        <div className="editor-panel">
          <div className="panel-header">
            <div className="panel-header-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                📝 {activeFile ? activeFile.split('/').pop() : 'Untitled.asm'}
                <div className="samples-dropdown-container" ref={samplesMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSamplesDropdownOpen(!samplesDropdownOpen);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '4px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '4px',
                      marginLeft: '4px'
                    }}
                    onMouseOver={(e) => e.target.style.background = 'var(--bg-hover)'}
                    onMouseOut={(e) => e.target.style.background = 'transparent'}
                  >
                    ▼
                  </button>
                  {samplesDropdownOpen && (
                    <div className="samples-dropdown-menu" style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '6px',
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
                      zIndex: 10000,
                      minWidth: '240px',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <div style={{
                        padding: '10px 14px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: 'var(--text-tertiary)',
                        borderBottom: '1px solid var(--border)',
                        letterSpacing: '0.05em'
                      }}>
                        SAMPLE PROJECTS
                      </div>
                      {SAMPLE_PROJECTS.map((project, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setCode(project.code);
                            if (activeFile) {
                              setVirtualFiles(prev => ({ ...prev, [activeFile]: project.code }));
                            }
                            setSamplesDropdownOpen(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            textAlign: 'left',
                            fontSize: '13px',
                            cursor: 'pointer',
                            borderBottom: idx === SAMPLE_PROJECTS.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.02)',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => { e.target.style.background = 'var(--bg-hover)'; e.target.style.color = 'var(--text-primary)'; }}
                          onMouseOut={(e) => { e.target.style.background = 'none'; e.target.style.color = 'var(--text-secondary)'; }}
                        >
                          📂 {project.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </span>
              {isDirty && <span className="dirty-indicator">●</span>}
            </div>
            <div className="panel-header-actions">
              {mobileView && (
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setMobileExplorerOpen(true)}
                  title="Open File Explorer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px', fontSize: '13px', fontWeight: '600' }}
                >
                  📁
                </button>
              )}
              <button className="btn btn-success btn-run-top" onClick={runCode} title="Run Program (F5)">
                {mobileView ? '▶' : '▶ Run'}
              </button>
              {mobileView && (
                <button className={`btn btn-primary btn-save-mobile ${isDirty ? 'pulse' : ''}`} onClick={handleSave} title="Save File">
                  💾
                </button>
              )}
              {mobileView && (
                <div className="right-menu-container" ref={rightMenuRef} style={{ position: 'relative' }}>
                  <button className="btn btn-secondary right-menu-btn" onClick={() => setRightMenuOpen(!rightMenuOpen)}>
                    ⚙ Panels ▾
                  </button>
                  {rightMenuOpen && (
                    <div className="right-menu-dropdown" style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '6px',
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                      zIndex: 9999,
                      minWidth: '180px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <button className="right-menu-item" style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }} onClick={() => { setActiveMobileModal('cpu'); setRightMenuOpen(false); }}
                      onMouseOver={(e) => { e.target.style.background = 'var(--bg-hover)'; e.target.style.color = 'var(--text-primary)'; }}
                      onMouseOut={(e) => { e.target.style.background = 'none'; e.target.style.color = 'var(--text-secondary)'; }}>
                        💻 CPU State
                      </button>
                      <button className="right-menu-item" style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }} onClick={() => { setActiveMobileModal('memory'); setRightMenuOpen(false); }}
                      onMouseOver={(e) => { e.target.style.background = 'var(--bg-hover)'; e.target.style.color = 'var(--text-primary)'; }}
                      onMouseOut={(e) => { e.target.style.background = 'none'; e.target.style.color = 'var(--text-secondary)'; }}>
                        🧠 Memory Explorer
                      </button>
                      <button className="right-menu-item" style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }} onClick={() => { setActiveMobileModal('output'); setRightMenuOpen(false); }}
                      onMouseOver={(e) => { e.target.style.background = 'var(--bg-hover)'; e.target.style.color = 'var(--text-primary)'; }}
                      onMouseOut={(e) => { e.target.style.background = 'none'; e.target.style.color = 'var(--text-secondary)'; }}>
                        📊 Output Log
                      </button>
                      <button className="right-menu-item" style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }} onClick={() => { setActiveMobileModal('reference'); setRightMenuOpen(false); }}
                      onMouseOver={(e) => { e.target.style.background = 'var(--bg-hover)'; e.target.style.color = 'var(--text-primary)'; }}
                      onMouseOut={(e) => { e.target.style.background = 'none'; e.target.style.color = 'var(--text-secondary)'; }}>
                        📚 Instruction Reference
                      </button>
                    </div>
                  )}
                </div>
              )}
              <span className="auto-save-indicator">💾 Auto-saving...</span>
            </div>
          </div>

          <CodeMirror
            value={code}
            onChange={(val) => {
              setCode(val);
              setVirtualFiles(prev => ({
                ...prev,
                [activeFile]: val
              }));
              if (!isDirty) setIsDirty(true);
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
              <button
                className={`tab ${showReference ? 'active' : ''}`}
                onClick={() => setShowReference(!showReference)}
              >
                📚 Instruction Reference
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0 }}>📚 Instruction Reference</h3>
                  <button 
                    onClick={() => setShowReference(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '18px',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseOver={(e) => { e.target.style.background = 'var(--bg-hover)'; e.target.style.color = 'var(--text-primary)'; }}
                    onMouseOut={(e) => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--text-secondary)'; }}
                    title="Close Panel"
                  >
                    ✕
                  </button>
                </div>
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
          className={`terminal-container ${mobileView ? 'mobile-terminal' : 'desktop-terminal'} ${terminalMaximized ? 'maximized' : ''}`}
          style={(!mobileView && !terminalMaximized) ? { height: `${terminalHeight}px` } : {}}
          ref={terminalRef}
        >
          {!terminalMaximized && (
            <div
              className="terminal-handle"
              onMouseDown={handleTerminalMouseDown}
              onTouchStart={handleTerminalTouchStart}
            >
              <span className="handle-text">{'⋮⋮ Drag to Resize ⋮⋮'}</span>
            </div>
          )}

          <div className="terminal-header">
            <div className="terminal-title">
              <span className="terminal-icon">▶</span>
              <span>Terminal Output</span>
            </div>
            <div className="terminal-controls">
              <button 
                className="term-btn" 
                onClick={() => setTerminalMaximized(!terminalMaximized)} 
                title={terminalMaximized ? "Minimize" : "Maximize"}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', width: '28px', height: '24px' }}
              >
                {terminalMaximized ? "🗗" : "🗖"}
              </button>
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

      {/* Custom App-Style Dialog Modal */}
      {customDialog && (
        <div className="custom-dialog-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div className="custom-dialog-card" style={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '400px',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#f0f6fc' }}>
              {customDialog.title}
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#c9d1d9', lineHeight: 1.5 }}>
              {customDialog.message}
            </p>
            {customDialog.type === 'prompt' && (
              <input
                type="text"
                defaultValue={customDialog.defaultValue}
                id="custom-dialog-input"
                style={{
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  color: '#f0f6fc',
                  padding: '10px 12px',
                  fontSize: '14px',
                  outline: 'none',
                  width: '100%'
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    customDialog.onConfirm(e.target.value);
                  } else if (e.key === 'Escape') {
                    customDialog.onCancel();
                  }
                }}
              />
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              {customDialog.type !== 'alert' && (
                <button
                  onClick={customDialog.onCancel}
                  style={{
                    background: '#21262d',
                    border: '1px solid #30363d',
                    color: '#c9d1d9',
                    borderRadius: '6px',
                    padding: '0 16px',
                    height: '44px',
                    minWidth: '80px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s'
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => {
                  if (customDialog.type === 'prompt') {
                    const val = document.getElementById('custom-dialog-input')?.value;
                    customDialog.onConfirm(val);
                  } else {
                    customDialog.onConfirm();
                  }
                }}
                style={{
                  background: '#238636',
                  border: '1px solid rgba(240, 246, 252, 0.1)',
                  color: '#ffffff',
                  borderRadius: '6px',
                  padding: '0 20px',
                  height: '44px',
                  minWidth: '80px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
              >
                {customDialog.type === 'confirm' ? 'Confirm' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Mobile Modal Overlay for panels */}
      {mobileView && activeMobileModal && (
        <div className="mobile-fullscreen-modal" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'var(--bg-darkest)',
          zIndex: 9998,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}>
          {/* Modal Header */}
          <div className="modal-fullscreen-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-panel)'
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 'bold',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {activeMobileModal === 'cpu' && '💻 CPU State'}
              {activeMobileModal === 'memory' && '🧠 Memory Explorer'}
              {activeMobileModal === 'output' && '📊 Output Log'}
              {activeMobileModal === 'reference' && '📚 Instruction Reference'}
            </h2>
            <button
              onClick={() => setActiveMobileModal(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '4px 12px',
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>

          {/* Modal Content */}
          <div className="modal-fullscreen-body" style={{
            flex: 1,
            padding: '20px',
            overflowY: 'auto',
            fontSize: '15px'
          }}>
            {activeMobileModal === 'cpu' && (
              <div className="cpu-details-fullscreen">
                {/* General Registers */}
                <div className="registers-group" style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '15px', color: 'var(--success)', marginBottom: '12px' }}>📌 General Registers (16-bit)</h4>
                  <div className="register-grid-fullscreen" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '12px'
                  }}>
                    {['ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp', 'sp'].map(reg => (
                      <div key={reg} className="register-item-fullscreen" style={{
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{reg.toUpperCase()}</span>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffffff' }}>0x{(emulatorState.registers[reg] || 0).toString(16).toUpperCase().padStart(4, '0')}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>{emulatorState.registers[reg] || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Segment Registers */}
                <div className="registers-group" style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '15px', color: 'var(--success)', marginBottom: '12px' }}>📌 Segment Registers</h4>
                  <div className="register-grid-fullscreen" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '12px'
                  }}>
                    {['cs', 'ds', 'ss', 'es'].map(reg => (
                      <div key={reg} className="register-item-fullscreen" style={{
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{reg.toUpperCase()}</span>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffffff' }}>0x{(emulatorState.registers[reg] || 0).toString(16).toUpperCase().padStart(4, '0')}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>{emulatorState.registers[reg] || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Flags */}
                <div className="flags-group" style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '15px', color: 'var(--success)', marginBottom: '12px' }}>🚩 CPU Flags</h4>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px'
                  }}>
                    {Object.entries(FLAG_BITS).map(([flag, info]) => (
                      <div
                        key={flag}
                        className={`flag-item ${emulatorState.flags[flag.toLowerCase()] ? 'set' : 'clear'}`}
                        style={{
                          background: emulatorState.flags[flag.toLowerCase()] ? 'rgba(63, 185, 80, 0.15)' : 'var(--bg-panel)',
                          border: emulatorState.flags[flag.toLowerCase()] ? '1px solid var(--success)' : '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: emulatorState.flags[flag.toLowerCase()] ? 'var(--success)' : 'var(--text-secondary)' }}>{flag}</span>
                        <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{emulatorState.flags[flag.toLowerCase()] ? '1' : '0'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* IP Pointer */}
                <div className="ip-group">
                  <h4 style={{ fontSize: '15px', color: 'var(--success)', marginBottom: '12px' }}>⏩ Instruction Pointer</h4>
                  <div style={{
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffffff' }}>IP: 0x{(emulatorState.ip || 0).toString(16).toUpperCase().padStart(4, '0')}</span>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>({emulatorState.ip || 0})</span>
                  </div>
                </div>
              </div>
            )}

            {activeMobileModal === 'memory' && (
              <div className="memory-details-fullscreen">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--success)' }}>🧠 Memory Dump</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Base:</span>
                    <input
                      type="text"
                      placeholder="e.g. 0x0200"
                      style={{
                        background: '#0d1117',
                        border: '1px solid var(--border)',
                        color: '#ffffff',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        width: '90px',
                        fontSize: '14px'
                      }}
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
                
                <div className="memory-grid-fullscreen" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px',
                  overflowX: 'auto'
                }}>
                  {Array.from({ length: 16 }).map((_, row) => {
                    const rowAddr = memoryBaseAddress + row * 16;
                    return (
                      <div key={row} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '4px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.02)',
                        minWidth: '380px'
                      }}>
                        <span style={{ color: 'var(--text-tertiary)', fontWeight: 'bold', width: '55px' }}>
                          0x{rowAddr.toString(16).toUpperCase().padStart(4, '0')}:
                        </span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: '6px', flex: 1 }}>
                          {Array.from({ length: 16 }).map((_, col) => (
                            <span key={col} style={{
                              color: (emulatorState.memory[rowAddr + col] || 0) === 0 ? 'var(--text-tertiary)' : '#ffffff',
                              textAlign: 'center',
                              fontWeight: (emulatorState.memory[rowAddr + col] || 0) !== 0 ? 'bold' : 'normal'
                            }}>
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

            {activeMobileModal === 'output' && (
              <div className="output-details-fullscreen" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--success)' }}>Output Log</h4>
                  <button className="btn btn-danger btn-small" onClick={clearTerminal}>Clear</button>
                </div>
                <div style={{
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px',
                  color: '#ffffff',
                  minHeight: '200px',
                  overflowY: 'auto',
                  flex: 1
                }}>
                  {emulatorState.output.length === 0 ? (
                    <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>▶ Run code to see output...</div>
                  ) : (
                    emulatorState.output.map((line, idx) => (
                      <div key={idx} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <span style={{ color: 'var(--text-tertiary)', marginRight: '8px' }}>{idx + 1}.</span>
                        <span>{line}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeMobileModal === 'reference' && (
              <div className="reference-details-fullscreen">
                <input
                  type="text"
                  placeholder="Search instructions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: '#0d1117',
                    border: '1px solid var(--border)',
                    color: '#ffffff',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    width: '100%',
                    fontSize: '15px',
                    marginBottom: '16px',
                    outline: 'none'
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(searchQuery ? searchResults : Object.entries(INSTRUCTION_SET)).slice(0, 30).map(item => {
                    const name = searchQuery ? item.name : item[0];
                    const data = searchQuery ? item : item[1];
                    return (
                      <div
                        key={name}
                        onClick={() => {
                          insertInstruction(name);
                          setActiveMobileModal(null);
                        }}
                        style={{
                          background: 'var(--bg-panel)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '16px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontWeight: 'bold', color: 'var(--success)', fontSize: '16px', marginBottom: '4px' }}>{name.toUpperCase()}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>{data.description}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-tertiary)', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '4px' }}>
                          Example: {data.examples?.[0] || 'N/A'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full-Screen Mobile Explorer Modal */}
      {mobileView && mobileExplorerOpen && (
        <div className="mobile-fullscreen-modal" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'var(--bg-darkest)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}>
          {/* Header */}
          <div className="modal-fullscreen-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-panel)'
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 'bold',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              📁 Workspace Explorer
            </h2>
            <button
              onClick={() => setMobileExplorerOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '4px 12px',
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>

          {/* Quick-action utilities */}
          <div style={{
            display: 'flex',
            gap: '12px',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-dark)'
          }}>
            <button className="btn btn-secondary" onClick={refreshWorkspace} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', fontWeight: '600' }}>
              🔄 Refresh
            </button>
            <button className="btn btn-primary" onClick={triggerCreateFile} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', fontWeight: '600' }}>
              📄+ New File
            </button>
            <button className="btn btn-primary" onClick={triggerCreateFolder} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', fontWeight: '600' }}>
              📁+ New Folder
            </button>
          </div>

          {/* Workspace files list */}
          <div style={{
            flex: 1,
            padding: '20px',
            overflowY: 'auto'
          }}>
            {!workspacePath ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>No folder is opened in workspace.</p>
                <button className="btn btn-primary" onClick={openWorkspace}>
                  Open Folder
                </button>
              </div>
            ) : (
              <div className="explorer-tree" style={{ fontSize: '15px' }}>
                {isCreatingFolder && (
                  <div className="tree-folder-group editing" style={{ marginBottom: '8px' }}>
                    <div className="tree-folder-header" style={{ padding: '8px 12px' }}>
                      <span className="tree-icon">📁</span>
                      <input
                        type="text"
                        className="inline-explorer-input"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        onKeyDown={(e) => handleInlineInputKeyDown(e, 'folder')}
                        onBlur={(e) => { const val = e.target.value; setTimeout(() => handleNewFolderSubmit(val), 150); }}
                        autoFocus
                        placeholder="New folder..."
                        style={{
                          background: '#0d1117',
                          border: '1px solid var(--border)',
                          color: '#ffffff',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          width: '100%',
                          fontSize: '14px',
                          marginLeft: '8px'
                        }}
                      />
                    </div>
                  </div>
                )}
                
                {renderTree(wsFiles)}

                {isCreatingFile && (
                  <div className="tree-file-item root-file editing" style={{ marginTop: '8px', padding: '8px 12px' }}>
                    <span className="tree-icon">📄</span>
                    <input
                      type="text"
                      className="inline-explorer-input"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={(e) => handleInlineInputKeyDown(e, 'file')}
                      onBlur={(e) => { const val = e.target.value; setTimeout(() => handleNewFileSubmit(val), 150); }}
                      autoFocus
                      placeholder="new_file.asm..."
                      style={{
                        background: '#0d1117',
                        border: '1px solid var(--border)',
                        color: '#ffffff',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        width: '100%',
                        fontSize: '14px',
                        marginLeft: '8px'
                      }}
                    />
                  </div>
                )}
              </div>
            )}
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
