import { useState, useEffect } from 'react';
import { Zap, Plus, Calendar, CloudOff, Cloud, Edit2, Trash2, X } from 'lucide-react';
import type { ElectricityEntry, User } from '../App';
import { API_URL, getAuthHeaders } from '../utils/supabase/info';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

interface ElectricityPanelProps {
  currentUser: User;
}

// API_URL imported from utils/supabase/info (Cloudflare Worker)

// Safety helpers - OUTSIDE component to avoid React hook order issues
const safeNum = (val: any, decimals = 2): string => {
  const n = parseFloat(val);
  if (isNaN(n)) return '0.' + '0'.repeat(decimals);
  return n.toFixed(decimals);
};
const getConsumption = (entry: any) =>
  Number(entry.consumption ?? entry.unitsConsumed ?? entry.units ?? 0);
const getUnitCost = (entry: any) =>
  Number(entry.unitCost ?? entry.costPerUnit ?? entry.rate ?? 10);
const getTotalCost = (entry: any) =>
  Number(entry.totalCost ?? entry.electricityCost ?? entry.cost ?? 0);

export function ElectricityPanel({ currentUser }: ElectricityPanelProps) {
  const [entries, setEntries] = useState<ElectricityEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  
  // Form fields
  const [previousReading, setPreviousReading] = useState('');
  const [currentReading, setCurrentReading] = useState('');
  const [unitCost, setUnitCost] = useState('8.5'); // Default electricity cost per unit

  // Edit state
  const [editingEntry, setEditingEntry] = useState<ElectricityEntry | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);

  // Fetch entries from cloud on mount
  useEffect(() => {
    console.log('🔧 ElectricityPanel mounted with user:', currentUser.username, 'role:', currentUser.role);
    console.log('🔧 Role type:', typeof currentUser.role);
    console.log('🔧 Admin check:', currentUser.role === 'admin');
    console.log('🔧 Management check:', currentUser.role === 'management');
    console.log('🔧 Edit/Delete enabled:', currentUser.role === 'admin' || currentUser.role === 'management');
    fetchEntriesFromCloud();
  }, []);

  // Fetch entries from cloud
  const fetchEntriesFromCloud = async () => {
    try {
      console.log('📥 Fetching electricity entries from cloud...');
      setIsSyncing(true);
      setSyncStatus('syncing');

      const response = await fetchWithTimeout(`${API_URL}/electricity-entries`, {
        headers: {  },
        timeout: 35000, // FIX: was raw fetch() with NO timeout — caused server 50s timeout
        retries: 0,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawData = await response.json();
      // Handle both array response and object with entries property
      const cloudEntries: ElectricityEntry[] = Array.isArray(rawData) 
        ? rawData 
        : (rawData.entries || rawData.electricityEntries || []);
      console.log(`✅ Fetched ${cloudEntries.length} electricity entries from cloud`);
      
      setEntries(cloudEntries);
      setSyncStatus('success');
      
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (error) {
      console.error('❌ Error fetching electricity entries from cloud:', error);
      setSyncStatus('error');
      setEntries([]);
      alert('Unable to load electricity data. Please check your connection and refresh.');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Save entry to cloud
  const saveEntryToCloud = async (entry: ElectricityEntry) => {
    try {
      console.log('☁️ Saving electricity entry to cloud:', entry.id);
      
      const response = await fetchWithTimeout(`${API_URL}/electricity-entries`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Electricity entry saved to cloud:', result);
      return true;
    } catch (error) {
      console.error('❌ Error saving electricity entry to cloud:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const prev = parseFloat(previousReading);
    const curr = parseFloat(currentReading);
    const cost = parseFloat(unitCost);

    if (isNaN(prev) || isNaN(curr) || isNaN(cost)) {
      alert('Please enter valid numbers for all fields');
      return;
    }

    if (curr < prev) {
      alert('Current reading must be greater than or equal to previous reading');
      return;
    }

    const consumption = curr - prev;
    const totalCost = consumption * cost;

    const newEntry: ElectricityEntry = {
      id: Date.now().toString(),
      date: selectedDate,
      previousReading: prev,
      currentReading: curr,
      consumption,
      unitCost: cost,
      totalCost,
      createdBy: currentUser.username,
      createdAt: new Date().toISOString(),
    };

    // Save to cloud
    setIsSyncing(true);
    setSyncStatus('syncing');
    const cloudSaved = await saveEntryToCloud(newEntry);
    
    if (cloudSaved) {
      // Update local state with new entry
      const updatedEntries = [...entries, newEntry];
      setEntries(updatedEntries);
      
      setSyncStatus('success');
      alert('✅ Electricity entry saved to cloud successfully!');
    } else {
      setSyncStatus('error');
      alert('⚠️ Failed to save electricity entry. Please try again.');
    }
    
    setIsSyncing(false);
    setTimeout(() => setSyncStatus('idle'), 2000);
    
    // Reset form
    setPreviousReading('');
    setCurrentReading('');
    setShowForm(false);
  };

  // Delete entry from cloud
  const deleteEntryFromCloud = async (entryId: string) => {
    try {
      console.log('🗑️ Deleting electricity entry from cloud:', entryId);
      
      const response = await fetchWithTimeout(`${API_URL}/electricity-entries/${entryId}`, {
        method: 'DELETE',
        headers: {
          
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('✅ Electricity entry deleted from cloud');
      return true;
    } catch (error) {
      console.error('❌ Error deleting electricity entry from cloud:', error);
      return false;
    }
  };

  // Handle delete
  const handleDelete = async (entry: ElectricityEntry) => {
    const confirmDelete = confirm(
      `Are you sure you want to delete the electricity entry for ${entry.date}?\n\n` +
      `Previous Reading: ${safeNum(entry.previousReading)} kWh\n` +
      `Current Reading: ${safeNum(entry.currentReading)} kWh\n` +
      `Consumption: ${safeNum(getConsumption(entry))} kWh\n` +
      `Total Cost: ₹${safeNum(getTotalCost(entry))}`
    );

    if (!confirmDelete) return;

    setIsSyncing(true);
    setSyncStatus('syncing');
    
    const deleted = await deleteEntryFromCloud(entry.id);
    
    if (deleted) {
      // Remove from local state
      const updatedEntries = entries.filter(e => e.id !== entry.id);
      setEntries(updatedEntries);
      
      setSyncStatus('success');
      alert('✅ Electricity entry deleted successfully!');
    } else {
      setSyncStatus('error');
      alert('⚠️ Failed to delete electricity entry. Please try again.');
    }
    
    setIsSyncing(false);
    setTimeout(() => setSyncStatus('idle'), 2000);
  };

  // Update entry in cloud
  const updateEntryInCloud = async (entry: ElectricityEntry) => {
    try {
      console.log('✏️ Updating electricity entry in cloud:', entry.id);
      
      const response = await fetchWithTimeout(`${API_URL}/electricity-entries/${entry.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Electricity entry updated in cloud:', result);
      return true;
    } catch (error) {
      console.error('❌ Error updating electricity entry in cloud:', error);
      return false;
    }
  };

  // Start editing
  const handleEdit = (entry: ElectricityEntry) => {
    setEditingEntry(entry);
    setSelectedDate(entry.date);
    setPreviousReading(entry.previousReading.toString());
    setCurrentReading(entry.currentReading.toString());
    setUnitCost(entry.unitCost.toString());
    setShowEditForm(true);
    setShowForm(false);
  };

  // Handle edit submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingEntry) return;

    const prev = parseFloat(previousReading);
    const curr = parseFloat(currentReading);
    const cost = parseFloat(unitCost);

    if (isNaN(prev) || isNaN(curr) || isNaN(cost)) {
      alert('Please enter valid numbers for all fields');
      return;
    }

    if (curr < prev) {
      alert('Current reading must be greater than or equal to previous reading');
      return;
    }

    const consumption = curr - prev;
    const totalCost = consumption * cost;

    const updatedEntry: ElectricityEntry = {
      ...editingEntry,
      date: selectedDate,
      previousReading: prev,
      currentReading: curr,
      consumption,
      unitCost: cost,
      totalCost,
    };

    // Update in cloud
    setIsSyncing(true);
    setSyncStatus('syncing');
    const cloudUpdated = await updateEntryInCloud(updatedEntry);
    
    if (cloudUpdated) {
      // Update local state
      const updatedEntries = entries.map(e => 
        e.id === updatedEntry.id ? updatedEntry : e
      );
      setEntries(updatedEntries);
      
      setSyncStatus('success');
      alert('✅ Electricity entry updated successfully!');
    } else {
      setSyncStatus('error');
      alert('⚠️ Failed to update electricity entry. Please try again.');
    }
    
    setIsSyncing(false);
    setTimeout(() => setSyncStatus('idle'), 2000);
    
    // Reset form
    setEditingEntry(null);
    setPreviousReading('');
    setCurrentReading('');
    setShowEditForm(false);
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingEntry(null);
    setPreviousReading('');
    setCurrentReading('');
    setUnitCost('8.5');
    setShowEditForm(false);
  };

  // Sort entries by date (newest first)
  const sortedEntries = [...entries].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Calculate totals
  const totalConsumption = entries.reduce((sum, entry) => sum + entry.consumption, 0);
  const totalCostSum = entries.reduce((sum, entry) => sum + entry.totalCost, 0);

  return (
    <div className="space-y-6">
      {/* HUGE DEBUG BANNER - MUST BE VISIBLE */}
      <div className="bg-red-600 text-white border-4 border-yellow-400 rounded-lg p-6 text-center shadow-2xl animate-pulse">
        <h1 className="text-4xl font-bold mb-4">🚨 VERSION 2.1.10 LOADED 🚨</h1>
        <div className="text-2xl font-bold mb-4">
          USER: {currentUser.username} | ROLE: "{currentUser.role}"
        </div>
        <div className="text-xl bg-yellow-400 text-black p-4 rounded-lg font-bold">
          BUTTONS ENABLED: {String(currentUser.role === 'admin' || currentUser.role === 'management')}
        </div>
      </div>
      
      {/* Header with Statistics */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Zap className="text-yellow-500" size={32} />
            <div>
              <h2 className="text-2xl font-bold">
                Electricity Tracking 
                {currentUser.role === 'admin' && <span className="text-xs text-blue-600 ml-2">(Admin Mode)</span>}
                {currentUser.role === 'management' && <span className="text-xs text-green-600 ml-2">(Management Mode)</span>}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                {syncStatus === 'syncing' && (
                  <span className="text-xs text-blue-600 flex items-center gap-1">
                    <Cloud size={12} className="animate-pulse" />
                    Syncing...
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
                    Cloud sync failed
                  </span>
                )}
                {syncStatus === 'idle' && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Cloud size={12} />
                    Cloud enabled
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchEntriesFromCloud}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-400"
            >
              <Cloud size={20} />
              Refresh
            </button>
            {(currentUser.role === 'management' || currentUser.role === 'admin') && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
              >
                <Plus size={20} />
                {showForm ? 'Cancel' : 'Add Reading'}
              </button>
            )}
          </div>
        </div>

        {/* Permission Notice for Regular Users */}
        {currentUser.role !== 'management' && currentUser.role !== 'admin' && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 flex items-center gap-2">
              <Zap size={16} />
              <strong>Note:</strong> Only Management and Admin can add electricity entries. You can view all electricity records below.
            </p>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Entries</p>
            <p className="text-3xl font-bold text-blue-600">{entries.length}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Consumption</p>
            <p className="text-3xl font-bold text-purple-600">{totalConsumption.toFixed(2)} kWh</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Cost</p>
            <p className="text-3xl font-bold text-green-600">₹{totalCostSum.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      {showEditForm && (currentUser.role === 'admin' || currentUser.role === 'management') && editingEntry && (
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-blue-600">Edit Electricity Reading</h3>
            <button
              onClick={handleCancelEdit}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit Cost (₹/kWh)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Previous Reading (kWh)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={previousReading}
                  onChange={(e) => setPreviousReading(e.target.value)}
                  placeholder="Enter previous meter reading"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Reading (kWh)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={currentReading}
                  onChange={(e) => setCurrentReading(e.target.value)}
                  placeholder="Enter current meter reading"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Calculated Values Preview */}
            {previousReading && currentReading && unitCost && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Calculated Values:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p>
                    <span className="font-medium">Consumption:</span>{' '}
                    {(parseFloat(currentReading) - parseFloat(previousReading)).toFixed(2)} kWh
                  </p>
                  <p>
                    <span className="font-medium">Total Cost:</span> ₹
                    {((parseFloat(currentReading) - parseFloat(previousReading)) * parseFloat(unitCost)).toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-medium"
              >
                Update Reading
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Reading Form */}
      {showForm && (currentUser.role === 'management' || currentUser.role === 'admin') && !showEditForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4">Record Electricity Reading</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit Cost (₹/kWh)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Previous Reading (kWh)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={previousReading}
                  onChange={(e) => setPreviousReading(e.target.value)}
                  placeholder="Enter previous meter reading"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Reading (kWh)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={currentReading}
                  onChange={(e) => setCurrentReading(e.target.value)}
                  placeholder="Enter current meter reading"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Calculated Values Preview */}
            {previousReading && currentReading && unitCost && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Calculated Values:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p>
                    <span className="font-medium">Consumption:</span>{' '}
                    {(parseFloat(currentReading) - parseFloat(previousReading)).toFixed(2)} kWh
                  </p>
                  <p>
                    <span className="font-medium">Total Cost:</span> ₹
                    {((parseFloat(currentReading) - parseFloat(previousReading)) * parseFloat(unitCost)).toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors font-medium"
              >
                Submit Reading
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Entries List - Table Format */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold mb-4">Electricity Records</h3>
        
        {isSyncing && syncStatus === 'syncing' && entries.length === 0 ? (
          <div className="text-center py-12">
            <Cloud className="mx-auto mb-3 text-blue-500 animate-pulse" size={48} />
            <p className="text-gray-600">Loading electricity records from cloud...</p>
          </div>
        ) : sortedEntries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Previous Reading</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Current Reading</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Consumption</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Unit Cost</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Total Cost</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Submitted By</th>
                  {(currentUser.role === 'admin' || currentUser.role === 'management') && (
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedEntries.map((entry) => {
                  // Debug log for first entry
                  if (entry === sortedEntries[0]) {
                    console.log('🔍 Rendering table - Current user role:', currentUser.role);
                    console.log('🔍 Is Admin:', currentUser.role === 'admin');
                    console.log('🔍 Is Management:', currentUser.role === 'management');
                    console.log('🔍 Should show actions:', currentUser.role === 'admin' || currentUser.role === 'management');
                  }
                  return (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="text-yellow-500" size={16} />
                        <span className="font-semibold text-gray-900">{entry.date}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{safeNum(entry.previousReading)} kWh</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{safeNum(entry.currentReading)} kWh</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-semibold text-purple-600">{safeNum(getConsumption(entry))} kWh</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">₹{safeNum(getUnitCost(entry))}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-semibold text-green-600">₹{safeNum(getTotalCost(entry))}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.createdBy}</td>
                    {(currentUser.role === 'admin' || currentUser.role === 'management') && (
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(entry)}
                            disabled={isSyncing}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Edit entry"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(entry)}
                            disabled={isSyncing}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete entry"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Zap className="mx-auto mb-3 text-gray-400" size={48} />
            <p>No electricity readings recorded yet</p>
            <p className="text-sm mt-1">Click "Add Reading" to record your first entry</p>
          </div>
        )}
      </div>
      {/* Force Cache Clear Button */}
    </div>
  );
}
