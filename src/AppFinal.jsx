// src/AppFinal.jsx
import React, { useState, useRef, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { darcula } from '@uiw/codemirror-theme-darcula';
import { Emulator8086Enhanced } from './emulator/Emulator8086Enhanced';
import { INSTRUCTION_SET, FLAG_BITS, searchInstructions } from './data/InstructionSet8086';
import './styles/AppFinal.css';

export default function AppFinal() {
  const [code, setCode] = useState(`; Renance Playground - Complete 8086 Emulator
; Mobile & Desktop Responsive with Terminal Output

mov ax, 0x1234
add ax, 0x5678
cmp ax, 0x68AC
je success

mov bx, 0
jmp error

success:
  mov cx, 5
loop_start:
  dec cx
  jnz loop_start
  mov dx, 0xFF
  hlt

error:
  mov dx, 0x00
  hlt
`);

  const [emulatorState, setEmulatorState] = useState({
    registers: {},
    flags: {},
    ip: 0,
    memory: new Array(65536).fill(0),
    output: [],
    running: false,
  });

  const [activeTab, setActiveTab] = useState('cpu');
  const [showReference, setShowReference] = useState(window.innerWidth > 1024);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState(window.innerWidth < 768);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [isDragging, setIsDragging] = useState(false);

  const emulatorRef = useRef(new Emulator8086Enhanced());
  const autoSaveTimerRef = useRef(null);
  const terminalRef = useRef(null);
  const dragStartY = useRef(0);

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

  // Auto-save to IndexedDB
  useEffect(() => {
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveToIndexedDB('asmCode', code);
    }, 1000);

    return () => clearTimeout(autoSaveTimerRef.current);
  }, [code]);

  // Load from IndexedDB on mount
  useEffect(() => {
    loadFromIndexedDB('asmCode').then((saved) => {
      if (saved) setCode(saved);
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const runCode = () => {
    try {
      setTerminalOpen(true);
      setEmulatorState(prev => ({ ...prev, running: true }));

      emulatorRef.current.load(code);
      const output = emulatorRef.current.run();

      setEmulatorState({
        registers: { ...emulatorRef.current.registers },
        flags: { ...emulatorRef.current.flags },
        ip: emulatorRef.current.registers.ip,
        memory: [...emulatorRef.current.memory],
        output: [...output],
        running: false,
      });

      setActiveTab('output');
    } catch (err) {
      setEmulatorState(prev => ({
        ...prev,
        output: [...prev.output, `❌ Error: ${err.message}`],
        running: false,
      }));
      setActiveTab('output');
    }
  };

  const resetCode = () => {
    emulatorRef.current.reset();
    setEmulatorState({
      registers: { ...emulatorRef.current.registers },
      flags: { ...emulatorRef.current.flags },
      ip: 0,
      memory: new Array(65536).fill(0),
      output: [],
      running: false,
    });
  };

  const clearCode = () => {
    setCode('');
    resetCode();
  };

  const clearTerminal = () => {
    setEmulatorState(prev => ({
      ...prev,
      output: [],
    }));
  };

  const insertInstruction = (instr) => {
    setCode(code + '\n' + instr + ' ');
  };

  const searchResults = searchQuery ? searchInstructions(searchQuery) : [];

  return (
    <div className={`app-final ${mobileView ? 'mobile' : 'desktop'} ${isDragging ? 'dragging' : ''}`}>
      {/* Header */}
      <header className="header-final">
        <div className="header-brand">
          <h1>⚙️ Renance Playground</h1>
          <span className="badge">8086 Full ISA</span>
        </div>

        <div className="header-controls">
          <button className="btn btn-primary btn-run" onClick={runCode} title="Run Code (F5)">
            ▶ Run
          </button>
          <button className="btn btn-secondary btn-reset" onClick={resetCode} title="Reset CPU">
            🔄 Reset
          </button>
          <button className="btn btn-danger btn-clear" onClick={clearCode} title="Clear All">
            🗑 Clear
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
        {/* Editor Panel */}
        <div className="editor-panel">
          <div className="panel-header">
            <span className="panel-title">📝 Code Editor</span>
            <span className="auto-save-indicator">💾 Auto-saving...</span>
          </div>

          <CodeMirror
            value={code}
            onChange={setCode}
            theme={darcula}
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
                  <h4>🧠 Memory Dump (First 256 Bytes)</h4>
                  <div className="memory-grid">
                    {Array.from({ length: 16 }).map((_, row) => (
                      <div key={row} className="memory-row">
                        <span className="mem-addr">0x{(row * 16).toString(16).toUpperCase().padStart(4, '0')}:</span>
                        <div className="mem-bytes">
                          {Array.from({ length: 16 }).map((_, col) => (
                            <span key={col} className="mem-byte">
                              {(emulatorState.memory[row * 16 + col] || 0).toString(16).toUpperCase().padStart(2, '0')}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
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

          <div className="terminal-body">
            {emulatorState.output.length === 0 ? (
              <div className="terminal-empty">$ Ready for execution...</div>
            ) : (
              emulatorState.output.map((line, idx) => (
                <div key={idx} className="terminal-line">
                  <span className="term-prompt">$</span>
                  <span className="term-output">{line}</span>
                </div>
              ))
            )}
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
