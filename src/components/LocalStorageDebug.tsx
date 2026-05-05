import { useState, useEffect } from 'react';
import { getLocalStorageStats } from '../utils/clearLocalStorageCache';

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

export function LocalStorageDebug() {
  const [stats, setStats] = useState<LocalStorageStats | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    // Only show if explicitly enabled (Ctrl+Shift+L)
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        setShowDebug(!showDebug);
        if (!showDebug) {
          const currentStats = getLocalStorageStats();
          setStats(currentStats);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showDebug]);

  if (!showDebug || !stats) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg shadow-lg max-w-md max-h-96 overflow-auto z-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">localStorage Debug</h3>
        <button
          onClick={() => setShowDebug(false)}
          className="text-red-400 hover:text-red-300"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2 text-sm font-mono">
        <div>
          <strong>Total Size:</strong> {stats.totalSizeMB} MB
        </div>
        
        <div className="mt-3">
          <strong>Items:</strong>
        </div>
        {stats.items.map((item) => (
          <div key={item.key} className="pl-2 border-l-2 border-gray-600">
            <div className="text-blue-300">{item.key}</div>
            <div className="text-gray-400 text-xs">{item.sizeMB} MB</div>
          </div>
        ))}
      </div>
      
      <div className="mt-3 text-xs text-gray-400">
        Press Ctrl+Shift+L to toggle
      </div>
    </div>
  );
}
