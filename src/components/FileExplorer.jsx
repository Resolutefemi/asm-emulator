// src/components/FileExplorer.jsx
import React, { useState } from 'react';
import { Icons } from './IconSet';
import '../styles/FileExplorer.css';

export const FileExplorer = ({ 
  files, 
  activeFile, 
  onSelectFile, 
  onNewFile, 
  onDeleteFile,
  isOpen = true 
}) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={`file-explorer ${isOpen ? 'open' : 'closed'}`}>
      <div className="explorer-header">
        <h3>EXPLORER</h3>
        <button className="explorer-toggle" title="Toggle">
          <Icons.ChevronDown />
        </button>
      </div>
      
      <div className="explorer-content">
        {Object.entries(files).length === 0 ? (
          <div className="empty-explorer">No files</div>
        ) : (
          Object.entries(files).map(([path, content]) => (
            <div
              key={path}
              className={`file-item ${activeFile === path ? 'active' : ''}`}
              onClick={() => onSelectFile(path)}
              title={path}
            >
              <Icons.CodeFile />
              <span className="file-name">{path.split('/').pop()}</span>
              <button
                className="file-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFile(path);
                }}
                title="Delete"
              >
                <Icons.Close />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FileExplorer;
