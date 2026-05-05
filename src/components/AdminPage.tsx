import { useState, useEffect } from 'react';
import { ManagementPage } from './ManagementPage';
import { ElectricityPanel } from './ElectricityPanel';
import { DatabaseManagement } from './DatabaseManagement';
import { EnhancedReportGenerator } from './EnhancedReportGenerator';
import { PartyNamesManager } from './PartyNamesManager';
import { AdminNotifications } from './AdminNotifications';
import { LocalStorageDebug } from './LocalStorageDebug';
import { ExcelImport } from './ExcelImport';
import { Users, Zap, Settings, Database, FileSpreadsheet, Building2, Bell } from 'lucide-react';
import type { User } from '../App';

interface AdminPageProps {
  currentUser: User;
}

export function AdminPage({ currentUser }: AdminPageProps) {
  const [activeTab, setActiveTab] = useState<'approvals' | 'users' | 'electricity' | 'database' | 'reports' | 'party-names'>('approvals');
  const [users, setUsers] = useState<User[]>([]);
  const [showPartyNamesManager, setShowPartyNamesManager] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  // Load users
  useEffect(() => {
    const stored = localStorage.getItem('users');
    if (stored) {
      try {
        setUsers(JSON.parse(stored));
      } catch (error) {
        console.error('Error loading users:', error);
      }
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Header with notification count */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-blue-100 mt-1">System management and monitoring</p>
          </div>
          {notificationCount > 0 && (
            <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-lg px-6 py-3">
              <Bell className="text-yellow-300 animate-pulse" size={32} />
              <div>
                <div className="text-2xl font-bold">{notificationCount}</div>
                <div className="text-sm text-blue-100">Active Alert{notificationCount !== 1 ? 's' : ''}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Daily Notifications - Always visible at the top */}
      <AdminNotifications onNotificationCountChange={setNotificationCount} />

      {/* Admin Navigation */}
      <div className="bg-white rounded-lg shadow-md p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('approvals')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors flex-1 justify-center ${
              activeTab === 'approvals'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Settings size={20} />
            Approvals
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors flex-1 justify-center ${
              activeTab === 'users'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users size={20} />
            Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('electricity')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors flex-1 justify-center ${
              activeTab === 'electricity'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Zap size={20} />
            Electricity
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors flex-1 justify-center ${
              activeTab === 'database'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Database size={20} />
            Database
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors flex-1 justify-center ${
              activeTab === 'reports'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileSpreadsheet size={20} />
            Excel Reports
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'approvals' && (
        <ManagementPage currentUser={currentUser} />
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">User Management</h2>
              <button
                onClick={() => setShowPartyNamesManager(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Building2 size={20} />
                Manage Party Names
              </button>
            </div>
            <div className="space-y-2">
              {users.map(user => (
                <div key={user.id} className="border rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-sm text-gray-600">
                      Username: {user.username} | Role: {user.role}
                      {user.tableNumber && ` | Table: ${user.tableNumber}`}
                      {user.tableNumbers && ` | Tables: ${user.tableNumbers.join(', ')}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      user.role === 'management' ? 'bg-blue-100 text-blue-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {user.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'electricity' && (
        <ElectricityPanel currentUser={currentUser} />
      )}

      {activeTab === 'database' && (
        <div className="space-y-6">
          <ExcelImport onImportComplete={() => window.location.reload()} />
          <DatabaseManagement currentUser={currentUser} />
        </div>
      )}

      {activeTab === 'reports' && (
        <EnhancedReportGenerator currentUser={currentUser} />
      )}

      {/* Party Names Manager Modal */}
      {showPartyNamesManager && (
        <PartyNamesManager onClose={() => setShowPartyNamesManager(false)} />
      )}
      
      {/* localStorage Debug Tool (Ctrl+Shift+L to toggle) */}
      <LocalStorageDebug />
    </div>
  );
}
