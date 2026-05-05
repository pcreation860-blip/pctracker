/**
 * Version check utility to force app refresh when code changes
 * This ensures users get the latest version without localStorage errors
 */

const CURRENT_VERSION = '2.1.12'; // Increment this to force refresh
const VERSION_KEY = 'app_version';

export function checkVersion() {
  try {
    const storedVersion = localStorage.getItem(VERSION_KEY);
    const isUpgrading = sessionStorage.getItem('version_upgrading');
    
    // Prevent infinite reload loop
    if (isUpgrading === 'true') {
      console.log('🔄 Version upgrade in progress, skipping check...');
      sessionStorage.removeItem('version_upgrading');
      try {
        localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
      } catch (e) {
        console.error('Failed to set version after upgrade:', e);
      }
      return;
    }
    
    if (storedVersion !== CURRENT_VERSION) {
      console.log(`📦 Version update detected: ${storedVersion} → ${CURRENT_VERSION}`);
      console.log('🧹 Clearing cache and forcing refresh...');
      
      // Save current user session before clearing
      const currentUser = localStorage.getItem('currentUser');
      
      // Clear ALL localStorage to ensure clean state
      try {
        localStorage.clear();
      } catch (e) {
        console.error('Failed to clear localStorage:', e);
      }
      
      // Restore user session
      if (currentUser) {
        try {
          localStorage.setItem('currentUser', currentUser);
        } catch (e) {
          console.error('Failed to restore user session:', e);
        }
      }
      
      // Clear all caches
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name);
          });
        });
      }
      
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => {
            registration.unregister();
          });
        });
      }
      
      // Mark as upgrading to prevent infinite loop
      sessionStorage.setItem('version_upgrading', 'true');
      
      // Set new version
      try {
        localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
      } catch (e) {
        console.error('Failed to set version:', e);
      }
      
      // Force hard reload
      console.log('🔄 Reloading application...');
      setTimeout(() => window.location.reload(), 100);
    } else {
      console.log(`✅ App version ${CURRENT_VERSION} - up to date`);
    }
  } catch (error) {
    console.error('Version check failed:', error);
    // If version check fails, try to clear localStorage anyway
    try {
      localStorage.clear();
      window.location.reload();
    } catch (e) {
      // Last resort - just reload
      window.location.reload();
    }
  }
}