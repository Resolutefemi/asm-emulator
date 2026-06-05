// src/App.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import CodeMirror from '@uiw/react-codemirror';
import { darcula } from '@uiw/codemirror-theme-darcula';
import { Emulator8086 } from './emulator/Emulator8086';
import SplashScreen from './components/SplashScreen';
import ActivityBar from './components/ActivityBar';
import WorkspaceExplorer from './components/WorkspaceExplorer';
import TemplateBrowser from './components/TemplateBrowser';
import './styles/App.css';
import './styles/ActivityBar.css';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [code, setCode] = useState(`; Renance Playground - ASM 8086
; Hello, CPU!

mov ax, 0x1234
add bx, ax
jmp end

end:
  hlt
`);

  const [emulatorState, setEmulatorState] = useState({
    registers: { ax: 0, bx: 0, cx: 0, dx: 0, si: 0, di: 0, bp: 0, sp: 0xFFFF },
    flags: { cf: 0, pf: 0, af: 0, zf: 0, sf: 0, of: 0 },
    ip: 0,
    memory: new Array(65536).fill(0),
    output: [],
  });

  const [isRunning, setIsRunning] = useState(false);
  const [activePanel, setActivePanel] = useState('output'); // cpu, memory, output
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [errors, setErrors] = useState([]);
  const [cpuStats, setCpuStats] = useState({ cycles: 0, memory: '0 KB', runtime: '0ms' });

  // ── Activity Bar & Sidebar state ──
  const [activityTab, setActivityTab] = useState(null); // null | 'explorer' | 'templates'
  const [workspaceDir, setWorkspaceDir] = useState(null);       // directory name string
  const [workspaceFiles, setWorkspaceFiles] = useState([]);     // array of { name, handle }
  const [activeWorkspaceFile, setActiveWorkspaceFile] = useState(null);

  const emulatorRef = useRef(new Emulator8086());
  const autoSaveTimerRef = useRef(null);
  const lintTimerRef = useRef(null);

  // Auto-save to IndexedDB
  useEffect(() => {
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveToIndexedDB('asmCode', code);
    }, 1000);

    return () => clearTimeout(autoSaveTimerRef.current);
  }, [code]);

  // Real-time error detection
  useEffect(() => {
    clearTimeout(lintTimerRef.current);
    lintTimerRef.current = setTimeout(() => {
      validateASMCode(code);
    }, 500);

    return () => clearTimeout(lintTimerRef.current);
  }, [code]);

  // Load from IndexedDB on mount
  useEffect(() => {
    loadFromIndexedDB('asmCode').then((saved) => {
      if (saved) setCode(saved);
    });
    
    // Check for updates
    checkForUpdates();
  }, []);

  // Real-time ASM code validation
  const validateASMCode = (codeText) => {
    const newErrors = [];
    const lines = codeText.split('\n');
    const validInstructions = [
      'mov', 'add', 'sub', 'xor', 'and', 'or', 'shl', 'shr', 'rol', 'ror',
      'jmp', 'jz', 'jnz', 'je', 'jne', 'cmp', 'test', 'int', 'call', 'ret',
      'push', 'pop', 'inc', 'dec', 'neg', 'not', 'mul', 'div', 'nop', 'hlt'
    ];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';')) return;

      const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
      
      if (!validInstructions.includes(firstWord) && !trimmed.includes(':')) {
        if (!firstWord.match(/^0x[0-9a-f]+$/i) && firstWord !== '') {
          newErrors.push({
            line: idx + 1,
            message: `Unknown instruction: '${firstWord}'. Did you mean one of: mov, add, sub, jmp?`,
            severity: 'error'
          });
        }
      }

      if (trimmed.includes('mov ') && !trimmed.includes(',')) {
        newErrors.push({
          line: idx + 1,
          message: 'MOV instruction requires source and destination',
          severity: 'error'
        });
      }
    });

    setErrors(newErrors);
  };

  // Check for app updates
  const checkForUpdates = async () => {
    try {
      const response = await fetch('https://api.github.com/repos/Resolutefemi/asm-emulator/releases/latest', {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });
      if (response.ok) {
        const data = await response.json();
        const currentVersion = '0.1.0';
        if (data.tag_name && data.tag_name.replace('v', '') !== currentVersion) {
          setUpdateAvailable(true);
        }
      }
    } catch (err) {
      console.log('Update check failed:', err);
    }
  };

  const handleUpgrade = () => {
    window.open('https://github.com/Resolutefemi/asm-emulator/releases/latest', '_blank');
  };

  const runCode = () => {
    try {
      setTerminalOpen(true);
      setIsRunning(true);
      setActivePanel('output');
      
      const startTime = performance.now();
      emulatorRef.current.load(code);
      const output = emulatorRef.current.run();
      const endTime = performance.now();
      
      setCpuStats({
        cycles: emulatorRef.current.registers.ip || 0,
        memory: '256 KB',
        runtime: `${(endTime - startTime).toFixed(2)}ms`
      });

      setEmulatorState({
        registers: emulatorRef.current.registers,
        flags: emulatorRef.current.flags,
        ip: emulatorRef.current.ip,
        memory: emulatorRef.current.memory || new Array(65536).fill(0),
        output: [...emulatorState.output, ...output],
      });
      setIsRunning(false);
    } catch (err) {
      setTerminalOpen(true);
      setEmulatorState({
        ...emulatorState,
        output: [...emulatorState.output, `❌ Error: ${err.message}`],
      });
      setIsRunning(false);
    }
  };

  const resetCode = () => {
    emulatorRef.current.reset();
    setEmulatorState({
      registers: emulatorRef.current.registers,
      flags: emulatorRef.current.flags,
      ip: 0,
      memory: new Array(65536).fill(0),
      output: [],
    });
  };

  const clearCode = () => {
    setCode('');
    resetCode();
  };

  const insertAtCursor = (text) => {
    setCode(code + '\n' + text + ' ');
  };

  const clearTerminalOutput = () => {
    setEmulatorState({ ...emulatorState, output: [] });
  };

  const toggleTerminal = () => {
    setTerminalOpen(!terminalOpen);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  // ── Workspace folder picker ──
  const handleOpenFolder = useCallback(async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      const files = [];
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'file' && name.toLowerCase().endsWith('.asm')) {
          files.push({ name, handle });
        }
      }
      files.sort((a, b) => a.name.localeCompare(b.name));
      setWorkspaceDir(dirHandle.name);
      setWorkspaceFiles(files);
      setActiveWorkspaceFile(null);
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Folder open error:', err);
    }
  }, []);

  // ── Load file from workspace into editor ──
  const handleSelectWorkspaceFile = useCallback(async (fileEntry) => {
    try {
      const file = await fileEntry.handle.getFile();
      const text = await file.text();
      setCode(text);
      setActiveWorkspaceFile(fileEntry.name);
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  }, []);

  // ── Insert template into editor ──
  const handleInsertTemplate = useCallback((templateCode) => {
    setCode(templateCode);
  }, []);

  const sidebarVisible = activityTab !== null;

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <button className="mobile-menu-btn" onClick={toggleMobileMenu}>
            ☰
          </button>
          <h1 className="app-title">⚙️ Renance Playground</h1>
          <span className="subtitle">8086 ASM Emulator</span>
        </div>
        
        {/* CPU Stats Bar - Hidden on mobile */}
        <div className="cpu-stats-bar">
          <div className="stat-item">
            <span className="stat-label">Cycles:</span>
            <span className="stat-value">{cpuStats.cycles}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Memory:</span>
            <span className="stat-value">{cpuStats.memory}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Runtime:</span>
            <span className="stat-value">{cpuStats.runtime}</span>
          </div>
        </div>

        <div className="header-controls">
          {updateAvailable && (
            <button className="btn btn-upgrade" onClick={handleUpgrade} title="Update available">
              ⬆ Upgrade
            </button>
          )}
          <button className="btn btn-run" onClick={runCode} disabled={isRunning}>
            ▶ Run
          </button>
          <button className="btn btn-reset" onClick={resetCode}>
            🔄 Reset
          </button>
          <button className="btn btn-clear" onClick={clearCode}>
            🗑 Clear
          </button>
        </div>
      </header>

      {/* Mobile Menu Sidebar */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu-sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-header">
              <h3>Navigation</h3>
              <button className="close-btn" onClick={() => setMobileMenuOpen(false)}>✕</button>
            </div>
            <div className="sidebar-content">
              <div className="menu-section">
                <h4>File Operations</h4>
                <button className="menu-item" onClick={() => { setCode(''); setMobileMenuOpen(false); }}>
                  📄 New File
                </button>
                <button className="menu-item" onClick={() => { clearCode(); setMobileMenuOpen(false); }}>
                  🗑 Clear Code
                </button>
              </div>
              <div className="menu-section">
                <h4>View</h4>
                <button className="menu-item" onClick={() => { setActivePanel('output'); setTerminalOpen(true); setMobileMenuOpen(false); }}>
                  📡 Output Terminal
                </button>
                <button className="menu-item" onClick={() => { setActivePanel('cpu'); setMobileMenuOpen(false); }}>
                  📊 CPU State
                </button>
                <button className="menu-item" onClick={() => { setActivePanel('memory'); setMobileMenuOpen(false); }}>
                  💾 Memory View
                </button>
              </div>
              <div className="menu-section">
                <h4>Tools</h4>
                <button className="menu-item" onClick={() => { checkForUpdates(); setMobileMenuOpen(false); }}>
                  🔄 Check Updates
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="content-wrapper">
        {/* ── Activity Bar (desktop only, far-left 48px strip) ── */}
        <ActivityBar
          activeTab={activityTab}
          onTabChange={setActivityTab}
        />

        {/* ── Primary Sidebar (250px, swaps between explorer / templates) ── */}
        <div className={`primary-sidebar${sidebarVisible ? '' : ' sidebar-hidden'}`}>
          {activityTab === 'explorer' && (
            <WorkspaceExplorer
              workspaceDir={workspaceDir}
              workspaceFiles={workspaceFiles}
              activeFile={activeWorkspaceFile}
              onSelectFile={handleSelectWorkspaceFile}
              onOpenFolder={handleOpenFolder}
            />
          )}
          {activityTab === 'templates' && (
            <TemplateBrowser onInsertTemplate={handleInsertTemplate} />
          )}
        </div>

        {/* Editor Panel */}
        <div className="editor-panel">
          <div className="panel-header">
            <div className="editor-title-section">
              <span className="panel-title">📝 Code Editor</span>
              <span className="auto-save">💾 Auto-saving...</span>
            </div>
            {errors.length > 0 && (
              <div className="error-badge">{errors.length} error{errors.length !== 1 ? 's' : ''}</div>
            )}
          </div>

          {/* Real-time Error Display */}
          {errors.length > 0 && (
            <div className="error-panel">
              {errors.map((err, idx) => (
                <div key={idx} className="error-item">
                  <span className="error-line">Line {err.line}:</span>
                  <span className="error-message">{err.message}</span>
                </div>
              ))}
            </div>
          )}

          <CodeMirror
            value={code}
            onChange={setCode}
            theme={darcula}
            extensions={[javascript()]}
            height="100%"
            width="100%"
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              foldGutter: true,
              dropCursor: true,
              allowMultipleSelections: true,
              indentOnInput: true,
            }}
            className="code-editor"
          />
        </div>

        {/* Right Panel - CPU/Memory/Output (Hidden on mobile when terminal open) */}
        <div className={`right-panel ${terminalOpen ? 'terminal-expanded' : ''}`}>
          {/* Panel Tabs */}
          <div className="panel-tabs">
            <button
              className={`tab ${activePanel === 'output' ? 'active' : ''}`}
              onClick={() => setActivePanel('output')}
            >
              📡 Terminal
            </button>
            <button
              className={`tab ${activePanel === 'cpu' ? 'active' : ''}`}
              onClick={() => setActivePanel('cpu')}
            >
              📊 CPU
            </button>
            <button
              className={`tab ${activePanel === 'memory' ? 'active' : ''}`}
              onClick={() => setActivePanel('memory')}
            >
              💾 Memory
            </button>
            <button className="tab-close-btn" onClick={toggleTerminal} title="Close terminal">
              ✕
            </button>
          </div>

          {/* Terminal/Output Panel */}
          {activePanel === 'output' && (
            <div className="panel-content output-panel">
              <div className="terminal-header">
                <span className="terminal-title">$ Terminal</span>
                <button className="terminal-clear-btn" onClick={clearTerminalOutput} title="Clear output">
                  Clear
                </button>
              </div>
              <div className="output-log">
                <div className="terminal-prompt">How are you doing$</div>
                {emulatorState.output.length === 0 ? (
                  <p className="no-output">Run your code to see output...</p>
                ) : (
                  emulatorState.output.map((line, idx) => (
                    <div key={idx} className="output-line">
                      {line}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* CPU State Panel */}
          {activePanel === 'cpu' && (
            <div className="panel-content cpu-panel">
              <div className="register-group">
                <h3>General Registers</h3>
                <div className="registers-grid">
                  <div className="register">
                    <span className="reg-name">AX</span>
                    <span className="reg-value">0x{emulatorState.registers.ax.toString(16).toUpperCase().padStart(4, '0')}</span>
                  </div>
                  <div className="register">
                    <span className="reg-name">BX</span>
                    <span className="reg-value">0x{emulatorState.registers.bx.toString(16).toUpperCase().padStart(4, '0')}</span>
                  </div>
                  <div className="register">
                    <span className="reg-name">CX</span>
                    <span className="reg-value">0x{emulatorState.registers.cx.toString(16).toUpperCase().padStart(4, '0')}</span>
                  </div>
                  <div className="register">
                    <span className="reg-name">DX</span>
                    <span className="reg-value">0x{emulatorState.registers.dx.toString(16).toUpperCase().padStart(4, '0')}</span>
                  </div>
                </div>
              </div>

              <div className="register-group">
                <h3>Pointer & Index Registers</h3>
                <div className="registers-grid">
                  <div className="register">
                    <span className="reg-name">SI</span>
                    <span className="reg-value">0x{emulatorState.registers.si.toString(16).toUpperCase().padStart(4, '0')}</span>
                  </div>
                  <div className="register">
                    <span className="reg-name">DI</span>
                    <span className="reg-value">0x{emulatorState.registers.di.toString(16).toUpperCase().padStart(4, '0')}</span>
                  </div>
                  <div className="register">
                    <span className="reg-name">BP</span>
                    <span className="reg-value">0x{emulatorState.registers.bp.toString(16).toUpperCase().padStart(4, '0')}</span>
                  </div>
                  <div className="register">
                    <span className="reg-name">SP</span>
                    <span className="reg-value">0x{emulatorState.registers.sp.toString(16).toUpperCase().padStart(4, '0')}</span>
                  </div>
                </div>
              </div>

              <div className="register-group">
                <h3>Flags</h3>
                <div className="flags-grid">
                  <div className="flag" title="Carry Flag">
                    <span className="flag-name">CF</span>
                    <span className={`flag-value ${emulatorState.flags.cf ? 'active' : ''}`}>
                      {emulatorState.flags.cf ? '1' : '0'}
                    </span>
                  </div>
                  <div className="flag" title="Zero Flag">
                    <span className="flag-name">ZF</span>
                    <span className={`flag-value ${emulatorState.flags.zf ? 'active' : ''}`}>
                      {emulatorState.flags.zf ? '1' : '0'}
                    </span>
                  </div>
                  <div className="flag" title="Sign Flag">
                    <span className="flag-name">SF</span>
                    <span className={`flag-value ${emulatorState.flags.sf ? 'active' : ''}`}>
                      {emulatorState.flags.sf ? '1' : '0'}
                    </span>
                  </div>
                  <div className="flag" title="Overflow Flag">
                    <span className="flag-name">OF</span>
                    <span className={`flag-value ${emulatorState.flags.of ? 'active' : ''}`}>
                      {emulatorState.flags.of ? '1' : '0'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="register-group">
                <h3>Instruction Pointer</h3>
                <div className="ip-display">
                  IP: 0x{emulatorState.ip.toString(16).toUpperCase().padStart(4, '0')}
                </div>
              </div>
            </div>
          )}

          {/* Memory Panel */}
          {activePanel === 'memory' && (
            <div className="panel-content memory-panel">
              <div className="memory-dump">
                <h3>Memory (First 256 bytes)</h3>
                <div className="hex-dump">
                  {Array.from({ length: 16 }).map((_, row) => (
                    <div key={row} className="hex-row">
                      <span className="hex-addr">0x{(row * 16).toString(16).toUpperCase().padStart(4, '0')}:</span>
                      <span className="hex-bytes">
                        {Array.from({ length: 16 }).map((_, col) => (
                          <span key={col} className="hex-byte">
                            {emulatorState.memory[row * 16 + col]
                              .toString(16)
                              .toUpperCase()
                              .padStart(2, '0')}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Symbol Navbar */}
      <div className="mobile-navbar">
        <div className="symbol-grid">
          <button className="symbol-btn" onClick={() => insertAtCursor('mov')}>
            mov
          </button>
          <button className="symbol-btn" onClick={() => insertAtCursor('add')}>
            add
          </button>
          <button className="symbol-btn" onClick={() => insertAtCursor('sub')}>
            sub
          </button>
          <button className="symbol-btn" onClick={() => insertAtCursor('jmp')}>
            jmp
          </button>
          <button className="symbol-btn" onClick={() => insertAtCursor('jz')}>
            jz
          </button>
          <button className="symbol-btn" onClick={() => insertAtCursor('jnz')}>
            jnz
          </button>
          <button className="symbol-btn" onClick={() => insertAtCursor('cmp')}>
            cmp
          </button>
          <button className="symbol-btn" onClick={() => insertAtCursor('int')}>
            int
          </button>
          <button className="symbol-btn" onClick={() => insertAtCursor('ret')}>
            ret
          </button>
          <button className="symbol-btn" onClick={() => insertAtCursor('push')}>
            push
          </button>
          <button className="symbol-btn" onClick={() => insertAtCursor('pop')}>
            pop
          </button>
          <button className="symbol-btn" onClick={() => insertAtCursor('xor')}>
            xor
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

// IndexedDB helpers
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
