// src/components/IconSet.jsx
// Lightweight SVG icons replacing emoji across the app

export const Icons = {
  // File types
  File: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 2a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2zm1 0v12h10V2H3z"/>
    </svg>
  ),

  CodeFile: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.927 5.427L6.06 4.294c.196-.196.513-.196.707 0l.707.707a.5.5 0 0 1 0 .707L6.12 7l1.354 1.292a.5.5 0 0 1 0 .707l-.707.707a.5.5 0 0 1-.707 0L4.927 9.573a.5.5 0 0 1 0-.707L6.28 7.514 4.927 6.134a.5.5 0 0 1 0-.707z"/>
      <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2z"/>
    </svg>
  ),

  Folder: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M.5 3a.5.5 0 0 0 0 1h1v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4h1a.5.5 0 0 0 0-1H15V2a2 2 0 0 0-2-2H9l-1-1H2a2 2 0 0 0-2 2v1H.5zm3-1a1 1 0 0 1 1-1h5.5a1 1 0 0 1 1 1v1H3.5V2zm10 9V4H1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1z"/>
    </svg>
  ),

  // Actions
  Run: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
    </svg>
  ),

  Reset: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1.5 4a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 0-1H2.707l3.147-3.146a.5.5 0 1 0-.707-.707L2 8.293V4.5a.5.5 0 0 0-.5-.5z"/>
    </svg>
  ),

  Clear: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
      <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 1a.5.5 0 0 0-.5.5v1h12V1.5a.5.5 0 0 0-.5-.5h-11z"/>
    </svg>
  ),

  Close: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
    </svg>
  ),

  Split: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V2a1 1 0 0 1 1-1z"/>
      <path d="M3 2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4a1 1 0 0 1 0 2H3a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3h4a1 1 0 0 1 0 2H3z"/>
      <path d="M13 2a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-4a1 1 0 1 1 0-2h4a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1h-4a1 1 0 0 1 0-2h4z"/>
    </svg>
  ),

  Menu: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h11A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11zM2.5 2a.5.5 0 0 0-.5.5v1h12V2.5a.5.5 0 0 0-.5-.5h-11zm0 12h11a.5.5 0 0 0 .5-.5v-9h-12v9a.5.5 0 0 0 .5.5z"/>
    </svg>
  ),

  ChevronRight: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
    </svg>
  ),

  ChevronDown: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
    </svg>
  ),

  Hamburger: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
    </svg>
  ),

  // Panels
  Terminal: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H2zm0 1h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>
      <path d="M3.854 5.146a.5.5 0 0 1 0 .708l-2 2a.5.5 0 1 1-.708-.708l2-2a.5.5 0 0 1 .708 0zM6.5 5a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2a.5.5 0 0 1 .5-.5z"/>
    </svg>
  ),

  Output: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6zm2 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
    </svg>
  ),

  Memory: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5 2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3V2zm0 2v8h6V4H5z"/>
    </svg>
  ),

  CPU: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6.5 1a1.5 1.5 0 0 0 0 3h3a1.5 1.5 0 0 0 0-3h-3zM4 5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H4zm6.5 10a1.5 1.5 0 0 0 0-3h-3a1.5 1.5 0 0 0 0 3h3z"/>
    </svg>
  ),

  Upgrade: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
      <path d="M8.854 6.646a.5.5 0 0 0-.708 0l-3 3a.5.5 0 1 0 .708.708L7.5 7.707V11a.5.5 0 0 0 1 0V7.707l2.146 2.147a.5.5 0 0 0 .708-.708l-3-3z"/>
    </svg>
  ),

  // Status
  Error: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
      <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
    </svg>
  ),

  Warning: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0l-5.5 9.9a1.13 1.13 0 0 0 .99 1.694h11.01a1.13 1.13 0 0 0 .99-1.694l-5.5-9.9zM8 2L5.05 9.5h5.9L8 2z"/>
      <path d="M8 11a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM8.93 5a.5.5 0 0 1-.866.5l-.746 1.789a.5.5 0 0 1-.5.25h-.427a.5.5 0 0 1-.5-.25l-.746-1.789A.5.5 0 0 1 7.07 5h.86z"/>
    </svg>
  ),

  Success: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M10.854 7.146a.5.5 0 0 1 0 .708l-5 5a.5.5 0 0 1-.708 0l-2.5-2.5a.5.5 0 0 1 .708-.708L5 11.293l4.646-4.647a.5.5 0 0 1 .708 0z"/>
      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
    </svg>
  ),
};

export default Icons;
