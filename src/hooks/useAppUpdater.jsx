import { useState, useEffect, useCallback } from 'react';

const isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined;

export function useAppUpdater() {
  const [updateStatus, setUpdateStatus] = useState('idle'); // 'idle' | 'checking' | 'available' | 'no-update' | 'downloading' | 'error'
  const [updateInfo, setUpdateInfo] = useState(null); // { version, notes, url, platform }
  const [errorMessage, setErrorMessage] = useState('');

  const compareVersions = (v1, v2) => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  };

  const checkForUpdates = useCallback(async (manual = false) => {
    if (!isTauri) {
      if (manual) setUpdateStatus('no-update');
      return;
    }

    setUpdateStatus('checking');
    setErrorMessage('');

    try {
      const isAndroid = /android/i.test(navigator.userAgent);

      if (isAndroid) {
        // Android APK custom fetch check
        // Using a mock/configurable URL for android update metadata
        const response = await fetch('https://example.com/update/android.json');
        if (!response.ok) {
          throw new Error('Failed to retrieve update metadata from server');
        }
        const data = await response.json();
        
        // Retrieve current app version using Tauri app API
        const currentVersion = await window.__TAURI__.app.getVersion();
        
        if (compareVersions(data.version, currentVersion) > 0) {
          setUpdateInfo({
            version: data.version,
            notes: data.notes || 'A new update is available for Android.',
            url: data.url,
            platform: 'android'
          });
          setUpdateStatus('available');
        } else {
          setUpdateStatus('no-update');
        }
      } else {
        // Desktop: listen to native Tauri updater silently
        const { check } = window.__TAURI__.updater;
        const update = await check();
        
        if (update) {
          setUpdateInfo({
            version: update.version,
            notes: update.body || 'A new update is available for Desktop.',
            url: null, // Managed internally by Tauri
            platform: 'desktop',
            updateObj: update
          });
          setUpdateStatus('available');
        } else {
          setUpdateStatus('no-update');
        }
      }
    } catch (err) {
      console.error('Update check failed:', err);
      setErrorMessage(err.message || 'Failed to check for updates');
      setUpdateStatus('error');
    }
  }, []);

  const installPendingUpdate = useCallback(async () => {
    if (!updateInfo) return;
    
    setUpdateStatus('downloading');
    setErrorMessage('');

    try {
      if (updateInfo.platform === 'android') {
        // Invoke Tauri Rust custom command to download APK and launch system installer
        await window.__TAURI__.invoke('download_and_install_apk', { url: updateInfo.url });
        setUpdateStatus('idle'); // The Android package installer prompt takes over the screen
      } else {
        // Desktop native installer process
        if (updateInfo && updateInfo.updateObj) {
          await updateInfo.updateObj.downloadAndInstall();
          
          // Relaunch Tauri application
          const { relaunch } = window.__TAURI__.process;
          await relaunch();
        }
      }
    } catch (err) {
      console.error('Installation failed:', err);
      setErrorMessage(err.message || 'Installation failed');
      setUpdateStatus('error');
    }
  }, [updateInfo]);

  const resetUpdater = () => {
    setUpdateStatus('idle');
    setUpdateInfo(null);
    setErrorMessage('');
  };

  // Perform a silent check shortly after application load
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  return {
    updateStatus,
    updateInfo,
    errorMessage,
    checkForUpdates,
    installPendingUpdate,
    resetUpdater
  };
}
