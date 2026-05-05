import { useState, useEffect } from 'react';
import { Trash2, Download, Upload, AlertTriangle, Database, RefreshCw } from 'lucide-react';
import { productionAPI, electricityAPI } from '../utils/api';
import type { ProductionEntry, ElectricityEntry } from '../App';

export function AdminDataManagement() {
  const [productionCount, setProductionCount] = useState(0);
  const [electricityCount, setElectricityCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteType, setDeleteType] = useState<'all' | 'production' | 'electricity'>('all');

  useEffect(() => {
    loadCounts();
  }, []);

  const loadCounts = async () => {
    try {
      const [prodEntries, elecEntries] = await Promise.all([
        productionAPI.getAll(),
        electricityAPI.getAll(),
      ]);
      setProductionCount(prodEntries.length);
      setElectricityCount(elecEntries.length);
    } catch (error) {
      console.error('Failed to load counts:', error);
    }
  };

  const handleDeleteAll = async () => {
    setLoading(true);
    try {
      const allProd = await productionAPI.getAll();
      const allElec = await electricityAPI.getAll();

      if (deleteType === 'all' || deleteType === 'production') {
        console.log(`Deleting ${allProd.length} production entries...`);
        for (const entry of allProd) {
          await productionAPI.delete(entry.id);
        }
        localStorage.removeItem('productionEntries');
      }

      if (deleteType === 'all' || deleteType === 'electricity') {
        console.log(`Deleting ${allElec.length} electricity entries...`);
        for (const entry of allElec) {
          await electricityAPI.delete(entry.id);
        }
        localStorage.removeItem('electricityEntries');
      }

      alert(`✅ Successfully deleted ${deleteType === 'all' ? 'all data' : deleteType + ' data'}!`);
      loadCounts();
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Delete failed:', error);
      alert('❌ Delete failed. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    setLoading(true);
    try {
      const [prodEntries, elecEntries] = await Promise.all([
        productionAPI.getAll(),
        electricityAPI.getAll(),
      ]);

      const exportData = {
        exportDate: new Date().toISOString(),
        productionEntries: prodEntries,
        electricityEntries: elecEntries,
        totalProduction: prodEntries.length,
        totalElectricity: elecEntries.length,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `production_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert('✅ Data exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      alert('❌ Export failed. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.productionEntries && Array.isArray(data.productionEntries)) {
        console.log(`Importing ${data.productionEntries.length} production entries...`);
        for (const entry of data.productionEntries) {
          try {
            await productionAPI.create(entry);
          } catch (error) {
            console.warn(`Skipped duplicate entry ${entry.id}`);
          }
        }
      }

      if (data.electricityEntries && Array.isArray(data.electricityEntries)) {
        console.log(`Importing ${data.electricityEntries.length} electricity entries...`);
        for (const entry of data.electricityEntries) {
          try {
            await electricityAPI.create(entry);
          } catch (error) {
            console.warn(`Skipped duplicate entry ${entry.id}`);
          }
        }
      }

      alert('✅ Data imported successfully!');
      loadCounts();
    } catch (error) {
      console.error('Import failed:', error);
      alert('❌ Import failed. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-3 mb-6">
        <Database className="text-red-600" size={28} />
        <div>
          <h2 className="text-xl font-bold text-red-600">Admin Data Management</h2>
          <p className="text-sm text-red-600">⚠️ USE WITH CAUTION - These actions are permanent!</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700 mb-1">Production Entries in Database</p>
          <p className="text-3xl font-bold text-blue-900">{productionCount}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-purple-700 mb-1">Electricity Entries in Database</p>
          <p className="text-3xl font-bold text-purple-900">{electricityCount}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-4">
        <div className="border-t pt-4">
          <h3 className="font-semibold mb-3">Data Management Actions</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Export Data */}
            <button
              onClick={handleExportData}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50"
            >
              <Download size={20} />
              Export All Data (Backup)
            </button>

            {/* Import Data */}
            <label className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors cursor-pointer">
              <Upload size={20} />
              Import Data (Restore)
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
                disabled={loading}
              />
            </label>

            {/* Refresh Counts */}
            <button
              onClick={loadCounts}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw size={20} />
              Refresh Counts
            </button>
          </div>
        </div>

        {/* Delete Section */}
        <div className="border-t pt-4">
          <h3 className="font-semibold mb-3 text-red-600">⚠️ Danger Zone - Delete Data</h3>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-3">
            <p className="text-sm text-red-800 mb-2">
              <strong>WARNING:</strong> These actions permanently delete data from both cloud database AND browser storage. This cannot be undone!
            </p>
            <p className="text-xs text-red-700">
              Recommendation: Export data as backup before deleting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => {
                setDeleteType('production');
                setShowDeleteConfirm(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-md transition-colors"
            >
              <Trash2 size={20} />
              Delete Production Data
            </button>

            <button
              onClick={() => {
                setDeleteType('electricity');
                setShowDeleteConfirm(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-md transition-colors"
            >
              <Trash2 size={20} />
              Delete Electricity Data
            </button>

            <button
              onClick={() => {
                setDeleteType('all');
                setShowDeleteConfirm(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
            >
              <Trash2 size={20} />
              Delete ALL Data
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <AlertTriangle size={32} />
              <h3 className="text-xl font-bold">Confirm Deletion</h3>
            </div>

            <div className="space-y-4">
              <p className="text-gray-800">
                Are you sure you want to delete <strong className="text-red-600">{deleteType === 'all' ? 'ALL DATA' : deleteType.toUpperCase() + ' DATA'}</strong>?
              </p>

              {deleteType === 'all' && (
                <div className="bg-red-100 border border-red-300 rounded-lg p-3">
                  <p className="text-red-900 font-semibold">This will permanently delete:</p>
                  <ul className="list-disc list-inside text-red-800 text-sm mt-2">
                    <li>{productionCount} production entries</li>
                    <li>{electricityCount} electricity entries</li>
                    <li>All data from cloud database</li>
                    <li>All data from browser storage</li>
                  </ul>
                </div>
              )}

              {deleteType === 'production' && (
                <div className="bg-orange-100 border border-orange-300 rounded-lg p-3">
                  <p className="text-orange-900">This will delete {productionCount} production entries from cloud and browser.</p>
                </div>
              )}

              {deleteType === 'electricity' && (
                <div className="bg-orange-100 border border-orange-300 rounded-lg p-3">
                  <p className="text-orange-900">This will delete {electricityCount} electricity entries from cloud and browser.</p>
                </div>
              )}

              <p className="text-sm text-red-600 font-semibold">
                ⚠️ THIS ACTION CANNOT BE UNDONE!
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={loading}
                  className="px-6 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAll}
                  disabled={loading}
                  className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Yes, Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
