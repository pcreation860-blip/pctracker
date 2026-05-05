import { useEffect, useState } from 'react';
import { CheckCircle, Shield } from 'lucide-react';

export function StartupBanner() {
  const [show, setShow] = useState(true);
  
  useEffect(() => {
    // Auto-hide after 3 seconds
    const timer = setTimeout(() => setShow(false), 3000);
    return () => clearTimeout(timer);
  }, []);
  
  if (!show) return null;
  
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-down">
      <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3">
        <Shield className="animate-pulse" size={24} />
        <div>
          <div className="font-bold flex items-center gap-2">
            <CheckCircle size={18} />
            Storage Protection Active
          </div>
          <div className="text-sm opacity-90">
            v2.1 • Enhanced with improved utilities
          </div>
        </div>
      </div>
    </div>
  );
}
