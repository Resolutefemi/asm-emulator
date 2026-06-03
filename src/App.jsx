// src/App.jsx
import React, { useState, useRef, useEffect } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import CodeMirror from '@uiw/react-codemirror';
import { darcula } from '@uiw/codemirror-theme-darcula';
import { Emulator8086 } from './emulator/Emulator8086';
import './styles/App.css';

export default function App() {
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
  const [activePanel, setActivePanel] = useState('cpu'); // cpu, memory, output
  const emulatorRef = useRef(new Emulator8086());
  const autoSaveTimerRef = useRef(null);

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
  }, []);

  const runCode = () => {
    try {
      emulatorRef.current.load(code);
      const output = emulatorRef.current.run();
      setEmulatorState({
        ...emulatorState,
        registers: emulatorRef.current.registers,
        flags: emulatorRef.current.flags,
        ip: emulatorRef.current.ip,
        output: [...emulatorState.output, ...output],
      });
      setIsRunning(false);
    } catch (err) {
      setEmulatorState({
        ...emulatorState,
        output: [...emulatorState.output, `❌ Error: ${err.message}`],
      });
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

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">⚙️ Renance Playground</h1>
          <span className="subtitle">8086 ASM Emulator</span>
        </div>
        <div className="header-controls">
          <button className="btn btn-run" onClick={runCode}>
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

      {/* Main Content */}
      <div className="content-wrapper">
        {/* Editor Panel */}
        <div className="editor-panel">
          <div className="panel-header">
            <span className="panel-title">📝 Code Editor</span>
            <span className="auto-save">💾 Auto-saving...</span>
          </div>
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

        {/* Right Panel - CPU/Memory/Output */}
        <div className="right-panel">
          {/* Panel Tabs */}
          <div className="panel-tabs">
            <button
              className={`tab ${activePanel === 'cpu' ? 'active' : ''}`}
              onClick={() => setActivePanel('cpu')}
            >
              📊 CPU State
            </button>
            <button
              className={`tab ${activePanel === 'memory' ? 'active' : ''}`}
              onClick={() => setActivePanel('memory')}
            >
              💾 Memory
            </button>
            <button
              className={`tab ${activePanel === 'output' ? 'active' : ''}`}
              onClick={() => setActivePanel('output')}
            >
              📡 Output
            </button>
          </div>

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

          {/* Output Panel */}
          {activePanel === 'output' && (
            <div className="panel-content output-panel">
              <h3>Execution Output</h3>
              <div className="output-log">
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
  );

  function insertAtCursor(text) {
    const lines = code.split('\n');
    setCode(code + '\n' + text + ' ');
  }
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
