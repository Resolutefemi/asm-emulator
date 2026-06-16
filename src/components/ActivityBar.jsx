// src/components/ActivityBar.jsx
import React from 'react';

// Classic overlapping dual-document (VS Code Files) icon
const ExplorerIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {/* Back document */}
    <path d="M6 4h8l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" opacity="0.45" fill="currentColor" stroke="currentColor"/>
    {/* Front document */}
    <path d="M4 7h8l4 4v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" fill="var(--bg-darker,#010409)" stroke="currentColor"/>
    {/* Folded corner crease */}
    <polyline points="12 7 12 11 16 11" opacity="0.7"/>
  </svg>
);

const TemplatesIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="9" height="8" rx="1.5"/>
    <rect x="13" y="3" width="9" height="8" rx="1.5"/>
    <rect x="2" y="13" width="9" height="8" rx="1.5"/>
    <rect x="13" y="13" width="9" height="8" rx="1.5"/>
    <path d="M5 7h3M5 5h3M16 7h3M16 5h3M5 17h3M5 15h3M16 17h3M16 15h3" strokeWidth="1.2" opacity="0.7"/>
  </svg>
);

export default function ActivityBar({ activeTab, onTabChange, onSettingsClick }) {
  const tabs = [
    {
      id: 'explorer',
      label: 'Explorer',
      icon: ExplorerIcon,
      title: 'Workspace Explorer (Ctrl+Shift+E)',
    },
    {
      id: 'templates',
      label: 'Templates',
      icon: TemplatesIcon,
      title: 'Sample Code & Templates (Ctrl+Shift+T)',
    },
  ];

  return (
    <aside className="activity-bar" aria-label="Activity Bar">
      <div className="activity-bar-icons">
        {tabs.map(({ id, icon: Icon, title, label }) => (
          <button
            key={id}
            id={`activity-tab-${id}`}
            className={`activity-bar-btn${activeTab === id ? ' active' : ''}`}
            onClick={() => onTabChange(activeTab === id ? null : id)}
            title={title}
            aria-label={label}
            aria-pressed={activeTab === id}
          >
            <Icon />
            {activeTab === id && <span className="activity-bar-active-indicator" />}
          </button>
        ))}
      </div>

      {/* Settings at the bottom */}
      <div className="activity-bar-bottom" style={{ marginTop: 'auto', marginBottom: '8px' }}>
        <button
          className="activity-bar-btn"
          onClick={onSettingsClick}
          title="Settings (Ctrl+,)"
          aria-label="Settings"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}
