import { useState, useEffect } from 'react';
import { ProductionForm } from './ProductionForm';
import { ProductionTable } from './ProductionTable';
import { ReportGenerator } from './ReportGenerator';
import { ElectricityPanel } from './ElectricityPanel';
import { FileText, Plus, Table, Zap, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import type { ProductionEntry, User } from '../App';
import { API_URL, getAuthHeaders } from '../utils/supabase/info';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

interface ProductionAppProps {
  currentUser: User;
}

// API_URL imported from utils/supabase/info (Cloudflare Worker)

export function ProductionApp({ currentUser }: ProductionAppProps) {
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'record' | 'view' | 'report' | 'electricity'>(
    currentUser.role === 'management' ? 'view' : 'record'
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  // Fetch entries from cloud on mount
  useEffect(() => {
    fetchEntriesFromCloud();
  }, []);

  // Fetch entries from cloud
  const fetchEntriesFromCloud = async () => {
    try {
      console.log('📥 Fetching production entries from cloud...');
      setIsSyncing(true);
      setSyncStatus('syncing');

      // Calculate date range for filtering (last 90 days by default)
      const today = new Date();
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const filterStartDate = ninetyDaysAgo.toISOString().split('T')[0];
      const filterEndDate = today.toISOString().split('T')[0];
      
      // FIX: Use pagination loop — old code only fetched first 500 entries ever
      const PAGE_SIZE = 200;
      const allCloudEntries: ProductionEntry[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const url = `${API_URL}/production-entries?limit=${PAGE_SIZE}&offset=${offset}&startDate=${filterStartDate}&endDate=${filterEndDate}`;
        console.log(`  → Fetching page offset=${offset}`);

        const response = await fetchWithTimeout(url, {
          method: 'GET',
          headers: {  },
          timeout: 35000,
          retries: 0,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`HTTP error! status: ${response.status}`, errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseData = await response.json();
        let pageEntries: ProductionEntry[] = [];

        if (responseData.entries && Array.isArray(responseData.entries)) {
          pageEntries = responseData.entries;
          hasMore = responseData.hasMore === true;
          console.log(`  ✅ Page offset=${offset}: ${pageEntries.length} entries (hasMore=${hasMore})`);
        } else if (Array.isArray(responseData)) {
          pageEntries = responseData;
          hasMore = false;
        } else {
          hasMore = false;
        }

        allCloudEntries.push(...pageEntries);
        offset += PAGE_SIZE;
        if (pageEntries.length === 0) hasMore = false;
      }

      console.log(`✅ Total fetched: ${allCloudEntries.length} production entries`);
      setEntries(allCloudEntries);
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (error) {
      console.error('❌ Error fetching production entries from cloud:', error);
      setSyncStatus('error');
      setEntries([]);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('timeout')) {
        alert('⏱️ Request timed out. The database is very large. Showing last 90 days of data.');
      } else {
        alert('Unable to load production data from cloud. Please check your connection and try refreshing the page.');
      }
      
      setTimeout(() => setSyncStatus('idle'), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Save entry to cloud
  const saveEntryToCloud = async (entry: ProductionEntry) => {
    try {
      console.log('☁️ Saving production entry to cloud:', entry.id);
      
      const response = await fetchWithTimeout(`${API_URL}/production-entries`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(entry),
        timeout: 20000, // 20 seconds
        retries: 1,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP error! status: ${response.status}`, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Production entry saved to cloud:', result);
      return true;
    } catch (error) {
      console.error('❌ Error saving production entry to cloud:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('timeout')) {
        alert('Save timed out. Please check if the entry was saved and try again if needed.');
      }
      return false;
    }
  };

  // Update entry in cloud
  const updateEntryInCloud = async (entry: ProductionEntry) => {
    try {
      console.log('☁️ Updating production entry in cloud:', entry.id);
      
      const response = await fetchWithTimeout(`${API_URL}/production-entries/${entry.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(entry),
        timeout: 15000,
        retries: 1,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Production entry updated in cloud:', result);
      return true;
    } catch (error) {
      console.error('❌ Error updating production entry in cloud:', error);
      return false;
    }
  };

  // Delete entry from cloud
  const deleteEntryFromCloud = async (id: string) => {
    try {
      console.log('☁️ Deleting production entry from cloud:', id);
      
      const response = await fetchWithTimeout(`${API_URL}/production-entries/${id}`, {
        method: 'DELETE',
        headers: {
          
        },
        timeout: 15000,
        retries: 1,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Production entry deleted from cloud:', result);
      return true;
    } catch (error) {
      console.error('❌ Error deleting production entry from cloud:', error);
      return false;
    }
  };

  const addEntry = async (entry: Omit<ProductionEntry, 'id' | 'createdBy' | 'approved'>) => {
    // Admin entries are auto-approved
    const isAutoApproved = currentUser.role === 'admin';
    
    const newEntry: ProductionEntry = {
      ...entry,
      id: Date.now().toString(),
      createdBy: currentUser.username,
      approved: isAutoApproved, // Auto-approve for admin
    };

    // Save to cloud
    setSyncStatus('syncing');
    const cloudSaved = await saveEntryToCloud(newEntry);
    
    if (cloudSaved) {
      // Update local state
      const updatedEntries = [...entries, newEntry];
      setEntries(updatedEntries);
      setSyncStatus('success');
      
      if (isAutoApproved) {
        alert('✅ Entry added and approved automatically (Admin)!');
      } else {
        alert('✅ Entry submitted for management approval and saved to cloud!');
      }
    } else {
      setSyncStatus('error');
      alert('⚠️ Entry submission failed. Please check your connection and try again.');
    }
    
    setTimeout(() => setSyncStatus('idle'), 2000);
  };

  const deleteEntry = async (id: string) => {
    // Delete from cloud
    const cloudDeleted = await deleteEntryFromCloud(id);
    
    if (cloudDeleted) {
      // Update local state
      const updatedEntries = entries.filter(entry => entry.id !== id);
      setEntries(updatedEntries);
    } else {
      alert('⚠️ Failed to delete entry from cloud. Please try again.');
    }
  };

  const updateEntry = async (id: string, updatedEntry: ProductionEntry) => {
    // Update in cloud
    const cloudUpdated = await updateEntryInCloud(updatedEntry);
    
    if (cloudUpdated) {
      // Update local state
      const updatedEntries = entries.map(entry => entry.id === id ? updatedEntry : entry);
      setEntries(updatedEntries);
    } else {
      alert('⚠️ Failed to update entry in cloud. Please try again.');
    }
  };

  // Filter entries based on user role
  const getFilteredEntries = () => {
    if (currentUser.role === 'management' || currentUser.role === 'admin') {
      return entries;
    }
    
    // Multi-table users can see entries from all their assigned tables
    if (currentUser.tableNumbers && currentUser.tableNumbers.length > 0) {
      const tableNames = currentUser.tableNumbers.map(num => `Table ${num}`);
      return entries.filter(entry => {
        return tableNames.some(tableName => entry.team.includes(tableName));
      });
    }
    
    // Single table users can only see their own entries
    return entries.filter(entry => entry.createdBy === currentUser.username);
  };

  return (
    <>
      {/* Sync Status and Refresh Button */}
      <div className="bg-white shadow-sm border rounded-lg mb-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="font-semibold text-gray-800">Production Database</h3>
              <div className="flex items-center gap-2 mt-1">
                {syncStatus === 'syncing' && (
                  <span className="text-xs text-blue-600 flex items-center gap-1">
                    <Cloud size={12} className="animate-pulse" />
                    Syncing with cloud...
                  </span>
                )}
                {syncStatus === 'success' && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <Cloud size={12} />
                    Synced with cloud
                  </span>
                )}
                {syncStatus === 'error' && (
                  <span className="text-xs text-red-600 flex items-center gap-1">
                    <CloudOff size={12} />
                    Cloud sync failed - using local storage
                  </span>
                )}
                {syncStatus === 'idle' && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Cloud size={12} />
                    Cloud sync enabled
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={fetchEntriesFromCloud}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Syncing...' : 'Refresh from Cloud'}
          </button>
        </div>
      </div>

      <nav className="bg-white shadow-sm border rounded-lg mb-6">
        <div className="flex space-x-1 p-1">
          {currentUser.role !== 'management' && (
            <button
              onClick={() => setActiveTab('record')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors rounded-md flex-1 justify-center ${
                activeTab === 'record'
                  ? 'bg-yellow-500 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Plus size={20} />
              Record Production
            </button>
          )}
          <button
            onClick={() => setActiveTab('view')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors rounded-md flex-1 justify-center ${
              activeTab === 'view'
                ? 'bg-yellow-500 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Table size={20} />
            View Records
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors rounded-md flex-1 justify-center ${
              activeTab === 'report'
                ? 'bg-yellow-500 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <FileText size={20} />
            Generate Report
          </button>
          <button
            onClick={() => setActiveTab('electricity')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors rounded-md flex-1 justify-center ${
              activeTab === 'electricity'
                ? 'bg-yellow-500 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Zap size={20} />
            Electricity
          </button>
        </div>
      </nav>

      {activeTab === 'record' && currentUser.role !== 'management' && (
        <ProductionForm onSubmit={addEntry} currentUser={currentUser} />
      )}
      {activeTab === 'view' && (
        <ProductionTable 
          entries={getFilteredEntries()} 
          onDelete={deleteEntry}
          onUpdate={updateEntry}
          currentUser={currentUser}
        />
      )}
      {activeTab === 'report' && <ReportGenerator entries={entries.filter(e => e.approved)} />}
      {activeTab === 'electricity' && <ElectricityPanel currentUser={currentUser} />}
    </>
  );
}