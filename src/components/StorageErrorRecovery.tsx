import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

export function StorageErrorRecovery() {
  const handleClearAll = () => {
    if (confirm('This will clear ALL browser data and reload the page. Continue?')) {
      try {
        // Clear localStorage
        localStorage.clear();
        
        // Clear sessionStorage
        sessionStorage.clear();
        
        // Clear all caches
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
          });
        }
        
        // Unregister service workers
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(reg => reg.unregister());
          });
        }
        
        // Hard reload
        window.location.reload();
      } catch (error) {
        alert('Failed to clear data. Please manually clear your browser cache and reload.');
      }
    }
  };
  
  const handleHardReload = () => {
    window.location.reload();
  };
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="bg-yellow-100 rounded-full p-3">
            <AlertTriangle className="text-yellow-600" size={28} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Storage Error Detected
            </h2>
            <p className="text-gray-600 text-sm">
              Your browser's storage is full or corrupted. This prevents the app from loading properly.
            </p>
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-blue-900 mb-2">Why did this happen?</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Old cached data is taking up space</li>
            <li>Browser storage quota exceeded</li>
            <li>Previous version data not cleared</li>
          </ul>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={handleHardReload}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <RefreshCw size={20} />
            Try Reloading
          </button>
          
          <button
            onClick={handleClearAll}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 size={20} />
            Clear All Data & Reload
          </button>
        </div>
        
        <div className="mt-4 text-xs text-gray-500 text-center">
          Note: Clearing data will log you out, but all your production data is safely stored in the cloud.
        </div>
      </div>
    </div>
  );
}
