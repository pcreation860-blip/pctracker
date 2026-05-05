import { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { ManagementPage } from './components/ManagementPage';
import { AdminPage } from './components/AdminPage';
import { ProductionApp } from './components/ProductionApp';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StartupBanner } from './components/StartupBanner';
import { ServerDiagnostics } from './components/ServerDiagnostics';
import { ToastContainer, useToast } from './components/Toast';
import { VersionIndicator } from './components/VersionIndicator';
import { clearLocalStorageCache } from './utils/clearLocalStorageCache';
import { protectLocalStorage } from './utils/protectLocalStorage';
import { checkVersion } from './utils/versionCheck';

// CRITICAL: Run protection and cleanup IMMEDIATELY before anything else
console.log('🚀 App starting...');

// 1. Check version and force refresh if needed
checkVersion();

// 2. Clear old localStorage cache
console.log('🧹 Clearing localStorage cache...');
clearLocalStorageCache();

// 3. Protect localStorage from future quota errors
protectLocalStorage();

// 4. Global error handler for localStorage quota errors
window.addEventListener('error', (event) => {
  if (event.error && event.error.name === 'QuotaExceededError') {
    console.error('🚨 QuotaExceededError caught globally:', event.error);
    event.preventDefault(); // Prevent error from bubbling
    
    // Try emergency cleanup
    try {
      ['productionEntries', 'electricityEntries', 'dailyReports', 'reportData'].forEach(key => {
        localStorage.removeItem(key);
      });
      console.log('✅ Emergency cleanup completed');
    } catch (e) {
      console.error('Emergency cleanup failed:', e);
    }
  }
});

console.log('✅ App initialization complete - ready to load');

export interface User {
  id: string;
  username: string;
  password: string;
  role: 'management' | 'table' | 'admin';
  name: string;
  tableNumber?: string;
  tableNumbers?: string[]; // For multi-table access users
  createdAt: string;
}

export interface ProductionEntry {
  id: string;
  date: string;
  team: string;
  shift: 'DAY' | 'NIGHT' | 'HALF NIGHT';
  partyName: string;
  designNo: string;
  thanNo: string;
  qtyMeters: number;
  total: number;
  chemical: string;
  factoryElectricity?: number;
  electricityCost?: number;
  productionCost?: number; // Cost per meter in Rs
  referencePictures: string[];
  colors: string[];
  createdBy: string;
  approved: boolean;
}

export interface ElectricityEntry {
  id: string;
  date: string;
  previousReading: number;
  currentReading: number;
  consumption: number;
  unitCost: number;
  totalCost: number;
  createdBy: string;
  createdAt: string;
}

const PREDEFINED_USERS: User[] = [
  {
    id: '1',
    username: 'Table 1',
    password: 'vishal1',
    role: 'table',
    name: 'Table 1',
    tableNumber: '1',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    username: 'Table 2',
    password: 'vishal2',
    role: 'table',
    name: 'Table 2',
    tableNumber: '2',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    username: 'Table 3',
    password: 'vishal3',
    role: 'table',
    name: 'Table 3',
    tableNumber: '3',
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    username: 'Table 4',
    password: 'vishal4',
    role: 'table',
    name: 'Table 4',
    tableNumber: '4',
    createdAt: new Date().toISOString(),
  },
  {
    id: '5',
    username: 'Management',
    password: 'vishal5',
    role: 'management',
    name: 'Management',
    createdAt: new Date().toISOString(),
  },
  {
    id: '6',
    username: 'Admin',
    password: 'vishal',
    role: 'admin',
    name: 'Admin',
    createdAt: new Date().toISOString(),
  },
  {
    id: '7',
    username: 'All Table',
    password: '0',
    role: 'table',
    name: 'All Table',
    tableNumbers: ['1', '2', '3', '4'],
    createdAt: new Date().toISOString(),
  },
  {
    id: '8',
    username: 'Mom',
    password: '1',
    role: 'table',
    name: 'Mom',
    tableNumbers: ['2', '3', '4'],
    createdAt: new Date().toISOString(),
  },
  {
    id: '9',
    username: 'Table 2&3',
    password: '3',
    role: 'table',
    name: 'Table 2&3',
    tableNumbers: ['2', '3'],
    createdAt: new Date().toISOString(),
  },
];

// DATA LOCKING: Entries older than 15 days are locked for non-admin users
export const isEntryLocked = (entryDate: string, userRole: string): boolean => {
  if (userRole === 'admin') return false; // Admin can always edit
  const entry = new Date(entryDate);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 15);
  cutoff.setHours(0, 0, 0, 0);
  return entry < cutoff;
};

// Check if today's entry can still be submitted (always allowed)
export const canSubmitToday = (): boolean => true;


export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users] = useState<User[]>(PREDEFINED_USERS);
  const [currentView, setCurrentView] = useState<'production' | 'management'>('production');
  const { toasts, removeToast } = useToast();

  useEffect(() => {
    // Initialize predefined users in localStorage
    try {
      const storedUsers = localStorage.getItem('users');
      if (!storedUsers) {
        localStorage.setItem('users', JSON.stringify(PREDEFINED_USERS));
      }
    } catch (error) {
      console.error('Failed to initialize users in localStorage:', error);
    }

    // Check for existing session
    try {
      const session = localStorage.getItem('currentSession');
      if (session) {
        const user = JSON.parse(session);
        setCurrentUser(user);
      }
    } catch (error) {
      console.error('Failed to restore session from localStorage:', error);
    }

    // Unregister any existing service workers to prevent MIME type errors
    // Service worker disabled in v2.1.7 - not required for core functionality
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
          console.log('🧹 Unregistered service worker:', registration.scope);
        });
      }).catch((error) => {
        console.log('Service worker cleanup failed (safe to ignore):', error);
      });
    }

  }, []);

  const handleLogin = (username: string, password: string): boolean => {
    const user = users.find(
      (u) => u.username === username && u.password === password
    );
    
    if (user) {
      setCurrentUser(user);
      try {
        localStorage.setItem('currentSession', JSON.stringify(user));
      } catch (error) {
        console.error('Failed to save session to localStorage:', error);
        // Continue anyway - user is still logged in in memory
      }
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentSession');
    setCurrentView('production');
  };

  if (!currentUser) {
    return (
      <ErrorBoundary>
        <ToastContainer toasts={toasts} onClose={removeToast} />
        <LoginPage onLogin={handleLogin} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <VersionIndicator />
      <StartupBanner />
      {currentUser.role === 'admin' && <ServerDiagnostics />}
      <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>

        {/* RESPONSIVE HEADER */}
        <header style={{
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '60px' }}>
              {/* Logo + Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{ width: '36px', height: '36px', background: 'white', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <span style={{ fontSize: '18px' }}>🏭</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <h1 style={{ fontSize: 'clamp(14px, 3vw, 20px)', fontWeight: 800,
                    color: 'white', margin: 0, lineHeight: 1.2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    PCTracker
                  </h1>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', margin: 0,
                    display: 'none' }} className="md-show">
                    Printing Table Management
                  </p>
                </div>
              </div>

              {/* Right side - user + actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {/* Role switcher for admin/management */}
                {(currentUser.role === 'management' || currentUser.role === 'admin') && (
                  <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.15)',
                    padding: '3px', borderRadius: '8px' }}>
                    <button onClick={() => setCurrentView('production')}
                      style={{ padding: '5px 10px', borderRadius: '6px', border: 'none',
                        fontSize: 'clamp(11px, 2vw, 13px)', fontWeight: 600, cursor: 'pointer',
                        background: currentView === 'production' ? 'white' : 'transparent',
                        color: currentView === 'production' ? '#d97706' : 'rgba(255,255,255,0.9)',
                        transition: 'all 0.2s', fontFamily: 'inherit' }}>
                      📊 Production
                    </button>
                    <button onClick={() => setCurrentView('management')}
                      style={{ padding: '5px 10px', borderRadius: '6px', border: 'none',
                        fontSize: 'clamp(11px, 2vw, 13px)', fontWeight: 600, cursor: 'pointer',
                        background: currentView === 'management' ? 'white' : 'transparent',
                        color: currentView === 'management' ? '#d97706' : 'rgba(255,255,255,0.9)',
                        transition: 'all 0.2s', fontFamily: 'inherit' }}>
                      {currentUser.role === 'admin' ? '⚙️ Admin' : '📋 Mgmt'}
                    </button>
                  </div>
                )}

                {/* User badge */}
                <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '8px',
                  padding: '4px 10px', textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: 'white', margin: 0, lineHeight: 1.3 }}>
                    {currentUser.name}
                  </p>
                  <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)', margin: 0 }}>
                    {currentUser.role.toUpperCase()}
                  </p>
                </div>

                {/* Logout */}
                <button onClick={handleLogout}
                  style={{ padding: '7px 12px', background: 'rgba(0,0,0,0.2)',
                    color: 'white', border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    whiteSpace: 'nowrap' }}>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* MAIN CONTENT - responsive padding */}
        <main style={{ flex: 1, maxWidth: '1400px', width: '100%', margin: '0 auto',
          padding: 'clamp(12px, 3vw, 24px) clamp(8px, 2vw, 24px)',
          boxSizing: 'border-box' }}>
          {currentView === 'management' && (currentUser.role === 'management' || currentUser.role === 'admin') ? (
            currentUser.role === 'admin' ? (
              <AdminPage currentUser={currentUser} />
            ) : (
              <ManagementPage currentUser={currentUser} />
            )
          ) : (
            <ProductionApp currentUser={currentUser} />
          )}
        </main>
      </div>

      <style>{`
        @media (min-width: 768px) { .md-show { display: block !important; } }
        * { -webkit-tap-highlight-color: transparent; }
        button { touch-action: manipulation; }
      `}</style>
    </ErrorBoundary>
  );
}
