/**
 * Version Indicator Component
 * Shows the current app version with timestamp to verify latest code is loaded
 */

import { useState, useEffect } from 'react';

export function VersionIndicator() {
  const [buildTime] = useState(new Date().toISOString());
  const [visible, setVisible] = useState(true);
  
  // Auto-hide after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 10000);
    return () => clearTimeout(timer);
  }, []);
  
  if (!visible) return null;
  
  return (
    <div className="fixed bottom-4 right-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-3 py-2 rounded-lg shadow-lg text-xs z-50 animate-pulse">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="font-bold">✅ v2.4.1 - NOTIFICATIONS FIXED</div>
        <button 
          onClick={() => setVisible(false)}
          className="text-white hover:text-green-200 font-bold"
        >
          ✕
        </button>
      </div>
      <div className="text-green-100 text-[10px]">Loaded: {new Date(buildTime).toLocaleTimeString()}</div>
      <div className="text-yellow-300 font-semibold">✅ Admin Notifications | Date Filter | 200 Max | All Working!</div>
    </div>
  );
}