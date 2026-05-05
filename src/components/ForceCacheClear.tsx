import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export function ForceCacheClear() {
  const [clearing, setClearing] = useState(false);

  const clearEverything = async () => {
    if (!confirm('This will clear ALL browser cache and reload the page. Continue?')) {
      return;
    }

    setClearing(true);
    
    try {
      console.log('🧹 Starting aggressive cache clear...');
      
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        console.log('🗑️ Found caches:', cacheNames);
        for (const name of cacheNames) {
          await caches.delete(name);
          console.log('🗑️ Deleted cache:', name);
        }
      }
      
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log('🗑️ Found service workers:', registrations.length);
        for (const registration of registrations) {
          await registration.unregister();
          console.log('🗑️ Unregistered service worker');
        }
      }
      
      // Clear local storage (but preserve session)
      const session = localStorage.getItem('currentUser');
      localStorage.clear();
      if (session) {
        localStorage.setItem('currentUser', session);
      }
      
      // Clear session storage
      sessionStorage.clear();
      
      console.log('✅ Cache cleared! Reloading...');
      
      // Hard reload with cache bypass
      window.location.reload();
      
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
      alert('Failed to clear cache. Please try Ctrl+Shift+R manually.');
      setClearing(false);
    }
  };

  return (
    <button
      onClick={clearEverything}
      disabled={clearing}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg shadow-2xl hover:bg-red-700 transition-all font-bold text-lg border-4 border-yellow-400 animate-bounce"
      style={{ animationDuration: '2s' }}
    >
      <RefreshCw size={24} className={clearing ? 'animate-spin' : ''} />
      {clearing ? 'CLEARING...' : 'FORCE RELOAD NOW!'}
    </button>
  );
}
