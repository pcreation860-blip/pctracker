import { useState, useEffect } from 'react';
import { 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  AlertTriangle, 
  CheckCircle,
  HardDrive,
  Cloud,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import type { ProductionEntry, ElectricityEntry, User } from '../App';
import { API_URL, getAuthHeaders } from '../utils/supabase/info';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

interface DatabaseManagementProps {
  currentUser: User;
}

// API_URL imported from utils/supabase/info (Cloudflare Worker)

export function DatabaseManagement({ currentUser }: DatabaseManagementProps) {
  const [productionEntries, setProductionEntries] = useState<ProductionEntry[]>([]);
  const [electricityEntries, setElectricityEntries] = useState<ElectricityEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<'production' | 'electricity' | 'all' | null>(null);

  // Load data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsSyncing(true);

    try {
      // FIX: Fetch ALL production entries using pagination loop.
      // Old code used limit=500 with no loop — entries beyond #500 were invisible in this view.
      const PAGE_SIZE = 200;
      const allProdEntries: ProductionEntry[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const prodResponse = await fetchWithTimeout(`${API_URL}/production-entries?limit=${PAGE_SIZE}&offset=${offset}`, {
          headers: {  },
          timeout: 35000,
          retries: 0,
        });
        if (!prodResponse.ok) break;

        const prodData = await prodResponse.json();
        let pageEntries: ProductionEntry[] = [];

        if (Array.isArray(prodData)) {
          pageEntries = prodData;
          hasMore = false;
        } else if (prodData.entries && Array.isArray(prodData.entries)) {
          pageEntries = prodData.entries;
          hasMore = prodData.hasMore === true;
          console.log(`📊 DB page offset=${offset}: ${pageEntries.length} entries (hasMore=${hasMore})`);
        } else {
          hasMore = false;
        }

        allProdEntries.push(...pageEntries);
        offset += PAGE_SIZE;
        if (pageEntries.length === 0) hasMore = false;
      }

      setProductionEntries(allProdEntries);
      console.log(`✅ DatabaseManagement loaded ${allProdEntries.length} production entries`);

      // Electricity entries (typically small, single fetch is fine)
      const elecResponse = await fetchWithTimeout(`${API_URL}/electricity-entries`, {
        headers: {  },
        timeout: 35000,
        retries: 0,
      });
      if (elecResponse.ok) {
        const elecData = await elecResponse.json();
        setElectricityEntries(Array.isArray(elecData) ? elecData : []);
      }
    } catch (error) {
      console.error('Error loading data from cloud:', error);
      // Fallback to localStorage
      const storedProd = localStorage.getItem('productionEntries');
      const storedElec = localStorage.getItem('electricityEntries');
      if (storedProd) setProductionEntries(JSON.parse(storedProd));
      if (storedElec) setElectricityEntries(JSON.parse(storedElec));
    }

    setIsSyncing(false);
  };

  // Export all data as JSON backup
  const exportBackup = () => {
    const backup = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      productionEntries,
      electricityEntries,
      metadata: {
        totalProductionRecords: productionEntries.length,
        totalElectricityRecords: electricityEntries.length,
        exportedBy: currentUser.username,
      }
    };

    const dataStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pctracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert('✅ Backup downloaded successfully!');
  };

  // Import backup from JSON file
  const importBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.productionEntries || !backup.electricityEntries) {
        alert('❌ Invalid backup file format!');
        return;
      }

      const confirmed = confirm(
        `This will restore:\n` +
        `- ${backup.productionEntries.length} production records\n` +
        `- ${backup.electricityEntries.length} electricity records\n\n` +
        `Current data will be replaced. Continue?`
      );

      if (!confirmed) return;

      setIsSyncing(true);

      // Upload to cloud
      let cloudSuccess = true;
      
      // Clear existing data first
      await deleteAllData('production', false);
      await deleteAllData('electricity', false);

      // Upload production entries
      for (const entry of backup.productionEntries) {
        try {
          await fetchWithTimeout(`${API_URL}/production-entries`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(entry),
          });
        } catch (error) {
          console.error('Error uploading production entry:', error);
          cloudSuccess = false;
        }
      }

      // Upload electricity entries
      for (const entry of backup.electricityEntries) {
        try {
          await fetchWithTimeout(`${API_URL}/electricity-entries`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(entry),
          });
        } catch (error) {
          console.error('Error uploading electricity entry:', error);
          cloudSuccess = false;
        }
      }

      setProductionEntries(backup.productionEntries);
      setElectricityEntries(backup.electricityEntries);
      setIsSyncing(false);

      if (cloudSuccess) {
        alert('✅ Backup restored successfully to cloud!');
      } else {
        alert('⚠️ Backup restored locally, but some cloud operations failed.');
      }
      
      // Reload data
      await loadAllData();
    } catch (error) {
      console.error('Error importing backup:', error);
      alert('❌ Failed to import backup. Please check the file format.');
      setIsSyncing(false);
    }
  };

  // Delete all data
  const deleteAllData = async (type: 'production' | 'electricity' | 'all', showAlert = true) => {
    setIsSyncing(true);

    try {
      if (type === 'production' || type === 'all') {
        // Delete from cloud
        for (const entry of productionEntries) {
          try {
            await fetchWithTimeout(`${API_URL}/production-entries/${entry.id}`, {
              method: 'DELETE',
              headers: {  },
            });
          } catch (error) {
            console.error('Error deleting production entry:', error);
          }
        }
        
        setProductionEntries([]);
      }

      if (type === 'electricity' || type === 'all') {
        // Delete from cloud
        for (const entry of electricityEntries) {
          try {
            await fetchWithTimeout(`${API_URL}/electricity-entries/${entry.id}`, {
              method: 'DELETE',
              headers: {  },
            });
          } catch (error) {
            console.error('Error deleting electricity entry:', error);
          }
        }
        
        setElectricityEntries([]);
      }

      if (showAlert) {
        alert('✅ Data deleted successfully!');
      }
    } catch (error) {
      console.error('Error deleting data:', error);
      if (showAlert) {
        alert('⚠️ Some data may not have been deleted from cloud.');
      }
    }

    setIsSyncing(false);
    setShowDeleteConfirm(null);
  };

  const handleDeleteClick = (type: 'production' | 'electricity' | 'all') => {
    const count = type === 'production' ? productionEntries.length :
                  type === 'electricity' ? electricityEntries.length :
                  productionEntries.length + electricityEntries.length;

    const message = type === 'all' 
      ? `Delete ALL ${productionEntries.length + electricityEntries.length} records?`
      : type === 'production'
      ? `Delete all ${productionEntries.length} production records?`
      : `Delete all ${electricityEntries.length} electricity records?`;

    if (confirm(`⚠️ WARNING: ${message}\n\nThis action CANNOT be undone!\n\nType 'DELETE' to confirm.`)) {
      const userConfirm = prompt('Type DELETE to confirm:');
      if (userConfirm === 'DELETE') {
        deleteAllData(type);
      } else {
        alert('Deletion cancelled - text did not match.');
      }
    }
  };

  // Calculate statistics
  // FIX: Added lastEntry — sorts all entries by date+timestamp to always show the true latest record
  const lastProductionEntry = productionEntries.length > 0
    ? [...productionEntries].sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
      })[0]
    : null;

  const stats = {
    productionRecords: productionEntries.length,
    electricityRecords: electricityEntries.length,
    totalRecords: productionEntries.length + electricityEntries.length,
    approvedRecords: productionEntries.filter(e => e.approved).length,
    pendingRecords: productionEntries.filter(e => !e.approved).length,
    totalElectricityCost: electricityEntries.reduce((sum, e) => sum + e.totalCost, 0),
    totalConsumption: electricityEntries.reduce((sum, e) => sum + e.consumption, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg shadow-md p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database size={40} />
            <div>
              <h2 className="text-2xl font-bold">Database Management</h2>
              <p className="text-blue-100 text-sm">Backup, restore, and manage your data</p>
            </div>
          </div>
          <button
            onClick={loadAllData}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-md hover:bg-blue-50 transition-colors disabled:bg-gray-200"
          >
            <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Production Records</p>
              <p className="text-3xl font-bold text-blue-600">{stats.productionRecords}</p>
            </div>
            <BarChart3 className="text-blue-500" size={40} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Electricity Records</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.electricityRecords}</p>
            </div>
            <HardDrive className="text-yellow-500" size={40} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved / Pending</p>
              <p className="text-3xl font-bold text-green-600">
                {stats.approvedRecords} / {stats.pendingRecords}
              </p>
            </div>
            <CheckCircle className="text-green-500" size={40} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Electricity Cost</p>
              <p className="text-2xl font-bold text-purple-600">₹{stats.totalElectricityCost.toFixed(2)}</p>
            </div>
            <Cloud className="text-purple-500" size={40} />
          </div>
        </div>
      </div>

      {/* Last Entry Card — FIX: Shows the most recent production entry so admin can verify data is current */}
      {lastProductionEntry && (
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <h3 className="text-lg font-bold mb-3 text-blue-700">📋 Last Production Entry</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Date</p>
              <p className="font-semibold">{lastProductionEntry.date}</p>
            </div>
            <div>
              <p className="text-gray-500">Party</p>
              <p className="font-semibold">{lastProductionEntry.partyName || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Design No.</p>
              <p className="font-semibold">{lastProductionEntry.designNo || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Qty (M)</p>
              <p className="font-semibold">{lastProductionEntry.qtyMeters ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Table</p>
              <p className="font-semibold">{lastProductionEntry.team || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Shift</p>
              <p className="font-semibold">{lastProductionEntry.shift || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Created By</p>
              <p className="font-semibold">{lastProductionEntry.createdBy || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Status</p>
              <p className={`font-semibold ${lastProductionEntry.approved ? 'text-green-600' : 'text-yellow-600'}`}>
                {lastProductionEntry.approved ? '✅ Approved' : '⏳ Pending'}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Entry ID: {lastProductionEntry.id} — out of {stats.productionRecords} total records
          </p>
        </div>
      )}

      {/* Backup & Restore */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Download size={24} className="text-green-500" />
          Backup & Restore
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export Backup */}
          <div className="border-2 border-green-200 rounded-lg p-6 hover:border-green-400 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <Download className="text-green-600" size={32} />
              <div>
                <h4 className="font-bold text-lg">Export Backup</h4>
                <p className="text-sm text-gray-600">Download all data as JSON</p>
              </div>
            </div>
            <button
              onClick={exportBackup}
              className="w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors font-medium"
            >
              Download Backup File
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Includes {stats.totalRecords} total records
            </p>
          </div>

          {/* Import Backup */}
          <div className="border-2 border-blue-200 rounded-lg p-6 hover:border-blue-400 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <Upload className="text-blue-600" size={32} />
              <div>
                <h4 className="font-bold text-lg">Import Backup</h4>
                <p className="text-sm text-gray-600">Restore from backup file</p>
              </div>
            </div>
            <label className="w-full block">
              <input
                type="file"
                accept=".json"
                onChange={importBackup}
                className="hidden"
                disabled={isSyncing}
              />
              <div className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-medium text-center cursor-pointer">
                {isSyncing ? 'Restoring...' : 'Choose Backup File'}
              </div>
            </label>
            <p className="text-xs text-gray-500 mt-2">
              ⚠️ Will replace current data
            </p>
          </div>
        </div>
      </div>

      {/* Delete Operations */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <AlertTriangle size={24} className="text-red-500" />
          Danger Zone
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Delete Production */}
          <div className="border-2 border-red-200 rounded-lg p-4">
            <h4 className="font-bold mb-2">Delete Production Records</h4>
            <p className="text-sm text-gray-600 mb-3">
              Remove all {stats.productionRecords} production entries
            </p>
            <button
              onClick={() => handleDeleteClick('production')}
              disabled={isSyncing || productionEntries.length === 0}
              className="w-full px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Trash2 size={16} className="inline mr-2" />
              Delete Production
            </button>
          </div>

          {/* Delete Electricity */}
          <div className="border-2 border-red-200 rounded-lg p-4">
            <h4 className="font-bold mb-2">Delete Electricity Records</h4>
            <p className="text-sm text-gray-600 mb-3">
              Remove all {stats.electricityRecords} electricity entries
            </p>
            <button
              onClick={() => handleDeleteClick('electricity')}
              disabled={isSyncing || electricityEntries.length === 0}
              className="w-full px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Trash2 size={16} className="inline mr-2" />
              Delete Electricity
            </button>
          </div>

          {/* Delete All */}
          <div className="border-2 border-red-400 rounded-lg p-4 bg-red-50">
            <h4 className="font-bold mb-2 text-red-700">Delete ALL Data</h4>
            <p className="text-sm text-gray-700 mb-3">
              ⚠️ Remove ALL {stats.totalRecords} records
            </p>
            <button
              onClick={() => handleDeleteClick('all')}
              disabled={isSyncing || stats.totalRecords === 0}
              className="w-full px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-800 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Trash2 size={16} className="inline mr-2" />
              Delete Everything
            </button>
          </div>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 flex items-center gap-2">
            <AlertTriangle size={16} />
            <strong>Warning:</strong> Delete operations cannot be undone! Always create a backup before deleting data.
          </p>
        </div>
      </div>

      {/* Storage Info */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold mb-4">Storage Information</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Cloud className="text-blue-600" size={24} />
              <div>
                <p className="font-semibold">Cloud Storage (Supabase)</p>
                <p className="text-sm text-gray-600">Primary data storage</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              Active
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <HardDrive className="text-gray-600" size={24} />
              <div>
                <p className="font-semibold">Local Storage (Browser)</p>
                <p className="text-sm text-gray-600">Backup & offline access</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              Synced
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}