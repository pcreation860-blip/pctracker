/**
 * Utility to clear old localStorage cache that is no longer needed
 * This helps prevent QuotaExceededError by removing unnecessary data
 */
export function clearLocalStorageCache() {
  try {
    // List of keys to remove (old cache data that's now stored in cloud)
    const keysToRemove = [
      'productionEntries',
      'electricityEntries',
      'dailyReports',
      'lastReportGenerated'
    ];

    let cleared = false;
    keysToRemove.forEach(key => {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const size = new Blob([item]).size;
          console.log(`🧹 Removing old localStorage cache: ${key} (${(size / 1024).toFixed(2)} KB)`);
          localStorage.removeItem(key);
          cleared = true;
        }
      } catch (e) {
        // If we can't even read it, try to remove it
        console.log(`🧹 Force removing corrupted cache: ${key}`);
        try {
          localStorage.removeItem(key);
          cleared = true;
        } catch (removeError) {
          console.error(`Failed to remove ${key}:`, removeError);
        }
      }
    });

    if (cleared) {
      console.log('✅ localStorage cache cleanup completed - large data removed');
    } else {
      console.log('✅ localStorage cache already clean');
    }
  } catch (error) {
    console.error('Error during localStorage cleanup:', error);
    
    // Last resort: try to clear everything except critical data
    try {
      const keysToKeep = ['users', 'currentSession', 'pwa-prompt-dismissed', 'admin_notifications'];
      const allKeys: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) allKeys.push(key);
      }
      
      allKeys.forEach(key => {
        if (!keysToKeep.includes(key)) {
          try {
            localStorage.removeItem(key);
            console.log(`🚨 Emergency cleanup removed: ${key}`);
          } catch (e) {
            // Ignore
          }
        }
      });
    } catch (emergencyError) {
      console.error('Emergency cleanup also failed:', emergencyError);
    }
  }
}

interface LocalStorageItem {
  key: string;
  size: number;
  sizeMB: string;
}

interface LocalStorageStats {
  totalSize: number;
  totalSizeMB: string;
  items: LocalStorageItem[];
}

/**
 * Get localStorage usage statistics
 */
export function getLocalStorageStats(): LocalStorageStats | null {
  try {
    let totalSize = 0;
    const items: { key: string; size: number }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || '';
        const size = new Blob([value]).size;
        totalSize += size;
        items.push({ key, size });
      }
    }

    // Sort by size descending
    items.sort((a, b) => b.size - a.size);

    return {
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      items: items.map(item => ({
        key: item.key,
        size: item.size,
        sizeMB: (item.size / 1024 / 1024).toFixed(2)
      }))
    };
  } catch (error) {
    console.error('Error getting localStorage stats:', error);
    return null;
  }
}
