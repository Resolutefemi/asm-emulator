// src/components/WorkspaceExplorer.jsx
import React, { useState, useCallback } from 'react';

const FolderOpenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h3.172a2 2 0 0 1 1.414.586l1.828 1.828A2 2 0 0 0 12.828 8H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
  </svg>
);

const FolderClosedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" opacity="0.75">
    <path d="M3 7a2 2 0 0 1 2-2h3.172a2 2 0 0 1 1.414.586l1.828 1.828A2 2 0 0 0 12.828 8H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
  </svg>
);

const AsmFileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="9" y1="13" x2="15" y2="13" strokeLinecap="round"/>
    <line x1="9" y1="17" x2="12" y2="17" strokeLinecap="round"/>
  </svg>
);

const ChevronRightIcon = ({ expanded }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }}
  >
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

function FileNode({ name, isActive, onClick }) {
  const ext = name.split('.').pop().toLowerCase();
  return (
    <div
      className={`ws-file-item${isActive ? ' ws-file-active' : ''}`}
      onClick={onClick}
      title={name}
    >
      <span className="ws-file-icon" style={{ color: ext === 'asm' ? '#58a6ff' : '#8b949e' }}>
        <AsmFileIcon />
      </span>
      <span className="ws-file-name">{name}</span>
    </div>
  );
}

export default function WorkspaceExplorer({ workspaceDir, workspaceFiles, activeFile, onSelectFile, onOpenFolder }) {
  const [expanded, setExpanded] = useState(true);

  const handleOpenFolder = useCallback(async () => {
    if (typeof window.showDirectoryPicker === 'function') {
      try {
        await onOpenFolder();
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Failed to open folder:', err);
        }
      }
    } else {
      alert('Your browser does not support the File System Access API. Please use a modern Chromium-based browser.');
    }
  }, [onOpenFolder]);

  const noFolderOpened = !workspaceDir;

  return (
    <div className="ws-explorer">
      {/* Section Header */}
      <div className="ws-section-title">EXPLORER</div>

      {noFolderOpened ? (
        /* ─── No Folder Opened State ─── */
        <div className="ws-no-folder">
          <div className="ws-no-folder-inner">
            <p className="ws-no-folder-heading">NO FOLDER OPENED</p>
            <p className="ws-no-folder-sub">You have not yet opened a folder.</p>
            <button
              id="ws-open-folder-btn"
              className="ws-open-folder-btn"
              onClick={handleOpenFolder}
            >
              Open Folder
            </button>
            <p className="ws-no-folder-hint">
              Opening a folder will close all currently open editors. To keep them open, add a folder instead.
            </p>
          </div>
        </div>
      ) : (
        /* ─── Folder Tree View ─── */
        <div className="ws-tree">
          {/* Root folder row */}
          <div
            className="ws-folder-row"
            onClick={() => setExpanded(e => !e)}
            title={workspaceDir}
          >
            <span className="ws-chevron"><ChevronRightIcon expanded={expanded} /></span>
            <span className="ws-folder-icon"><FolderClosedIcon /></span>
            <span className="ws-folder-name">
              {workspaceDir.split(/[\\/]/).filter(Boolean).pop() || workspaceDir}
            </span>
          </div>

          {expanded && (
            <div className="ws-children">
              {workspaceFiles.length === 0 ? (
                <p className="ws-empty-folder">No .asm files found.</p>
              ) : (
                workspaceFiles.map((file) => (
                  <FileNode
                    key={file.name}
                    name={file.name}
                    isActive={activeFile === file.name}
                    onClick={() => onSelectFile(file)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
