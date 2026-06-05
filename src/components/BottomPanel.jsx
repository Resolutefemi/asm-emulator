// src/components/BottomPanel.jsx
import React from 'react';
import { Icons } from './IconSet';
import '../styles/BottomPanel.css';

export const BottomPanel = ({ 
  activeTab, 
  onTabChange, 
  terminalOutput, 
  outputLog,
  memoryData,
  cpuState,
  onClearTerminal,
  onClearOutput
}) => {
  return (
    <div className="bottom-panel">
      <div className="panel-tabs">
        <button
          className={`panel-tab ${activeTab === 'terminal' ? 'active' : ''}`}
          onClick={() => onTabChange('terminal')}
          title="Terminal Output"
        >
          <Icons.Terminal />
          <span>TERMINAL</span>
        </button>
        
        <button
          className={`panel-tab ${activeTab === 'output' ? 'active' : ''}`}
          onClick={() => onTabChange('output')}
          title="Build Output"
        >
          <Icons.Output />
          <span>OUTPUT</span>
        </button>
        
        <button
          className={`panel-tab ${activeTab === 'cpu' ? 'active' : ''}`}
          onClick={() => onTabChange('cpu')}
          title="CPU State"
        >
          <Icons.CPU />
          <span>CPU STATE</span>
        </button>
        
        <button
          className={`panel-tab ${activeTab === 'memory' ? 'active' : ''}`}
          onClick={() => onTabChange('memory')}
          title="Memory Dump"
        >
          <Icons.Memory />
          <span>MEMORY</span>
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'terminal' && (
          <div className="terminal-content">
            <div className="terminal-toolbar">
              <span className="terminal-title">$ Terminal</span>
              <button className="clear-btn" onClick={onClearTerminal}>Clear</button>
            </div>
            <div className="terminal-output">
              <div className="terminal-prompt">How are you doing$</div>
              {terminalOutput.length === 0 ? (
                <div className="empty-state">Run code to see terminal output...</div>
              ) : (
                terminalOutput.map((line, idx) => (
                  <div key={idx} className="output-line">{line}</div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'output' && (
          <div className="output-content">
            <div className="output-toolbar">
              <span className="output-title">Build Output</span>
              <button className="clear-btn" onClick={onClearOutput}>Clear</button>
            </div>
            <div className="output-log">
              {outputLog.length === 0 ? (
                <div className="empty-state">Build output will appear here...</div>
              ) : (
                outputLog.map((line, idx) => (
                  <div key={idx} className="output-line">{line}</div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'cpu' && (
          <div className="cpu-content">
            <div className="registers-section">
              <h3>General Registers</h3>
              <div className="registers-grid">
                {Object.entries(cpuState.registers).map(([name, value]) => (
                  <div key={name} className="register-item">
                    <span className="reg-name">{name.toUpperCase()}</span>
                    <span className="reg-value">0x{value.toString(16).toUpperCase().padStart(4, '0')}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flags-section">
              <h3>Flags</h3>
              <div className="flags-grid">
                {Object.entries(cpuState.flags).map(([name, value]) => (
                  <div key={name} className={`flag-item ${value ? 'set' : ''}`}>
                    <span className="flag-name">{name.toUpperCase()}</span>
                    <span className="flag-value">{value ? '1' : '0'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ip-section">
              <h3>Instruction Pointer</h3>
              <div className="ip-value">
                IP: 0x{cpuState.ip.toString(16).toUpperCase().padStart(4, '0')}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'memory' && (
          <div className="memory-content">
            <h3>Memory Dump (First 256 bytes)</h3>
            <div className="memory-dump">
              {Array.from({ length: 16 }).map((_, row) => (
                <div key={row} className="memory-row">
                  <span className="addr">0x{(row * 16).toString(16).toUpperCase().padStart(4, '0')}:</span>
                  <span className="bytes">
                    {Array.from({ length: 16 }).map((_, col) => (
                      <span key={col} className="byte">
                        {memoryData[row * 16 + col]?.toString(16).toUpperCase().padStart(2, '0') || '00'}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BottomPanel;
