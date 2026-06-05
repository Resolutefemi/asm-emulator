// src/components/TabBar.jsx
import React from 'react';
import { Icons } from './IconSet';
import '../styles/TabBar.css';

export const TabBar = ({ tabs, activeTab, onTabChange, onCloseTab, onNewTab }) => {
  const getFileIcon = (filename) => {
    if (filename.endsWith('.asm')) return <Icons.CodeFile />;
    if (filename.endsWith('.md')) return <Icons.File />;
    return <Icons.CodeFile />;
  };

  return (
    <div className="tab-bar">
      <div className="tab-list">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            title={tab.filename}
          >
            <span className="tab-icon">
              {getFileIcon(tab.filename)}
            </span>
            <span className="tab-label">{tab.filename}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              title="Close"
            >
              <Icons.Close />
            </button>
          </button>
        ))}
      </div>
      
      <div className="tab-actions">
        <button
          className="tab-action-btn"
          onClick={onNewTab}
          title="New File"
        >
          +
        </button>
      </div>
    </div>
  );
};

export default TabBar;
