import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RefreshCw, Cloud, FileSpreadsheet, ClipboardCheck, Building2, Calendar, Edit2, Trash2, X, Database, Download, Upload, Plus } from 'lucide-react';
import type { ProductionEntry, User } from '../App';
import { API_URL, getAuthHeaders } from '../utils/supabase/info';
import { EnhancedReportGenerator } from './EnhancedReportGenerator';
import { ManagementBackup } from './ManagementBackup';
import { PartyNamesManager } from './PartyNamesManager';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

interface ManagementPageProps {
  currentUser: User;
}

// API_URL imported from utils/supabase/info (Cloudflare Worker)

export function ManagementPage({ currentUser }: ManagementPageProps) {
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'approvals' | 'reports' | 'backup'>('approvals');
  const [showPartyNamesManager, setShowPartyNamesManager] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ProductionEntry | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  // Picture editing state
  const [picEditEntry, setPicEditEntry] = useState<ProductionEntry | null>(null);
  const [picEditPics, setPicEditPics] = useState<string[]>([]);
  const [savingPics, setSavingPics] = useState(false);

  // Compress image to under 100KB
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_DIM = 600;
          let { width: w, height: h } = img;
          if (w > h && w > MAX_DIM) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
          else if (h > MAX_DIM) { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
          let q = 0.6;
          let url = canvas.toDataURL('image/jpeg', q);
          while (url.length > 100 * 1024 * 1.37 && q > 0.1) { q -= 0.1; url = canvas.toDataURL('image/jpeg', q); }
          resolve(url);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const openPicEdit = (entry: ProductionEntry) => {
    setPicEditEntry(entry);
    setPicEditPics([...(entry.referencePictures || [])]);
  };

  const handleAddPics = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    if (picEditPics.length + files.length > 5) { alert('Max 5 pictures per entry'); return; }
    for (const file of Array.from(files)) {
      const compressed = await compressImage(file);
      setPicEditPics(prev => [...prev, compressed]);
    }
    e.target.value = '';
  };

  const savePics = async () => {
    if (!picEditEntry) return;
    setSavingPics(true);
    try {
      const updated = { ...picEditEntry, referencePictures: picEditPics };
      const response = await fetchWithTimeout(`${API_URL}/production-entries/${picEditEntry.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updated),
        timeout: 30000,
        retries: 1,
      });
      if (!response.ok) throw new Error('Failed to save');
      setEntries(prev => prev.map(e => e.id === picEditEntry.id ? updated : e));
      setPicEditEntry(null);
      alert('✅ Pictures saved successfully!');
    } catch (err: any) {
      alert('❌ Failed to save pictures: ' + err.message);
    } finally {
      setSavingPics(false);
    }
  };

  // Load from cloud on mount
  useEffect(() => {
    fetchEntriesFromCloud();
  }, []);

  const fetchEntriesFromCloud = async () => {
    try {
      console.log('📥 [ManagementPage] Fetching production entries from cloud...');
      setIsSyncing(true);
      
      // Calculate date range for filtering (last 90 days by default)
      const today = new Date();
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const filterStartDate = ninetyDaysAgo.toISOString().split('T')[0];
      const filterEndDate = today.toISOString().split('T')[0];
      
      // Fetch with pagination and date filter
      // FIX: Pagination loop — fetches ALL entries for approval view
      const allEntries: any[] = [];
      let mgmtOffset = 0;
      let mgmtHasMore = true;
      while (mgmtHasMore) {
        const url = `${API_URL}/production-entries?limit=200&offset=${mgmtOffset}&startDate=${filterStartDate}&endDate=${filterEndDate}`;
        const response = await fetchWithTimeout(url, {
          method: 'GET',
          headers: {  },
          timeout: 35000,
          retries: 0,
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const responseData = await response.json();
        if (responseData.entries && Array.isArray(responseData.entries)) {
          allEntries.push(...responseData.entries);
          mgmtHasMore = responseData.hasMore === true;
        } else if (Array.isArray(responseData)) {
          allEntries.push(...responseData);
          mgmtHasMore = false;
        } else { mgmtHasMore = false; }
        mgmtOffset += 200;
        if (mgmtOffset > 10000) break;
      }
      const responseData = { entries: allEntries, total: allEntries.length };
      
      // Handle new pagination response format
      let cloudEntries: ProductionEntry[];
      if (responseData.entries) {
        // New format with pagination
        cloudEntries = responseData.entries;
        console.log(`✅ [ManagementPage] Fetched ${cloudEntries.length} entries (Total: ${responseData.total}, HasMore: ${responseData.hasMore})`);
      } else if (Array.isArray(responseData)) {
        // Old format (backwards compatibility)
        cloudEntries = responseData;
        console.log(`✅ [ManagementPage] Fetched ${cloudEntries.length} entries (legacy format)`);
      } else {
        console.error('Unexpected response format:', responseData);
        cloudEntries = [];
      }
      
      setEntries(cloudEntries);
    } catch (error) {
      console.error('❌ [ManagementPage] Error fetching from cloud:', error);
      setEntries([]);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('timeout')) {
        alert('⏱️ Request timed out. The database is very large. Try selecting a smaller date range.');
      } else {
        alert('Unable to load production data. Please check your connection and refresh.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleApprove = async (id: string) => {
    const entryToUpdate = entries.find(e => e.id === id);
    if (!entryToUpdate) return;

    const updatedEntry = { ...entryToUpdate, approved: true };

    // Update in cloud
    try {
      const response = await fetchWithTimeout(`${API_URL}/production-entries/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedEntry),
        timeout: 15000,
        retries: 1,
      });

      if (!response.ok) throw new Error('Failed to update in cloud');

      // Update local state
      const updatedEntries = entries.map(entry => 
        entry.id === id ? updatedEntry : entry
      );
      setEntries(updatedEntries);
      alert('✅ Entry approved and synced to cloud!');
    } catch (error) {
      console.error('Error approving entry:', error);
      alert('⚠️ Failed to approve entry. Please try again.');
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('Are you sure you want to reject and delete this entry?')) return;

    // Delete from cloud
    try {
      const response = await fetchWithTimeout(`${API_URL}/production-entries/${id}`, {
        method: 'DELETE',
        headers: {  },
        timeout: 15000,
        retries: 1,
      });

      if (!response.ok) throw new Error('Failed to delete from cloud');

      // Update local state
      const updatedEntries = entries.filter(entry => entry.id !== id);
      setEntries(updatedEntries);
      alert('✅ Entry rejected and deleted from cloud!');
    } catch (error) {
      console.error('Error rejecting entry:', error);
      alert('⚠️ Failed to reject entry. Please try again.');
    }
  };

  const handleEdit = (entry: ProductionEntry) => {
    setEditingEntry({ ...entry });
    setShowEditModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this approved entry? This cannot be undone.')) return;

    try {
      const response = await fetchWithTimeout(`${API_URL}/production-entries/${id}`, {
        method: 'DELETE',
        headers: {  },
        timeout: 15000,
        retries: 1,
      });

      if (!response.ok) throw new Error('Failed to delete from cloud');

      // Update local state
      const updatedEntries = entries.filter(entry => entry.id !== id);
      setEntries(updatedEntries);
      alert('✅ Entry deleted successfully!');
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('⚠️ Failed to delete entry. Please try again.');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;

    // Validate required fields
    if (!editingEntry.partyName || !editingEntry.designNo || !editingEntry.thanNo || 
        !editingEntry.qtyMeters || !editingEntry.chemical) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetchWithTimeout(`${API_URL}/production-entries/${editingEntry.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(editingEntry),
        timeout: 15000,
        retries: 1,
      });

      if (!response.ok) throw new Error('Failed to update in cloud');

      // Update local state
      const updatedEntries = entries.map(entry => 
        entry.id === editingEntry.id ? editingEntry : entry
      );
      setEntries(updatedEntries);
      setShowEditModal(false);
      setEditingEntry(null);
      alert('✅ Entry updated successfully!');
    } catch (error) {
      console.error('Error updating entry:', error);
      alert('⚠️ Failed to update entry. Please try again.');
    }
  };

  // Filter entries by date range
  const dateRangeEntries = entries.filter(entry => {
    const entryDate = new Date(entry.date);
    const start = new Date(startDate);
    const end = new Date(endDate);
    return entryDate >= start && entryDate <= end;
  });
  const pendingEntries = dateRangeEntries.filter(entry => !entry.approved);
  const approvedEntries = dateRangeEntries.filter(entry => entry.approved);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('approvals')}
            className={`flex items-center gap-2 px-6 py-3 rounded-md transition-colors flex-1 justify-center ${
              activeTab === 'approvals'
                ? 'bg-yellow-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ClipboardCheck size={20} />
            Approvals
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-6 py-3 rounded-md transition-colors flex-1 justify-center ${
              activeTab === 'reports'
                ? 'bg-yellow-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileSpreadsheet size={20} />
            Excel Reports
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 px-6 py-3 rounded-md transition-colors flex-1 justify-center ${
              activeTab === 'backup'
                ? 'bg-yellow-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Database size={20} />
            Backup
          </button>
        </div>
      </div>

      {/* Approvals Tab */}
      {activeTab === 'approvals' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Management Dashboard</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPartyNamesManager(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                <Building2 size={18} />
                Party Names
              </button>
              <button
                onClick={fetchEntriesFromCloud}
                disabled={isSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'Syncing...' : 'Refresh'}
              </button>
            </div>
          </div>
        
        {/* Date Range Selector */}
        <div className="mb-6 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="text-yellow-600" size={20} />
            <h3 className="text-lg font-semibold text-gray-800">Filter by Date Range</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setStartDate(today);
                  setEndDate(today);
                }}
                className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors text-sm font-medium"
              >
                Today
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const weekAgo = new Date(today);
                  weekAgo.setDate(today.getDate() - 7);
                  setStartDate(weekAgo.toISOString().split('T')[0]);
                  setEndDate(today.toISOString().split('T')[0]);
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm font-medium"
              >
                Last 7 Days
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const monthAgo = new Date(today);
                  monthAgo.setMonth(today.getMonth() - 1);
                  setStartDate(monthAgo.toISOString().split('T')[0]);
                  setEndDate(today.toISOString().split('T')[0]);
                }}
                className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors text-sm font-medium"
              >
                Last 30 Days
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Pending Approval</p>
            <p className="text-3xl font-bold text-yellow-600">{pendingEntries.length}</p>
            <p className="text-xs text-gray-500 mt-1">
              {startDate === endDate ? `for ${startDate}` : `${startDate} to ${endDate}`}
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Approved</p>
            <p className="text-3xl font-bold text-green-600">{approvedEntries.length}</p>
            <p className="text-xs text-gray-500 mt-1">
              {startDate === endDate ? `for ${startDate}` : `${startDate} to ${endDate}`}
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total in Range</p>
            <p className="text-3xl font-bold text-blue-600">{dateRangeEntries.length}</p>
            <p className="text-xs text-gray-500 mt-1">
              {startDate === endDate ? `for ${startDate}` : `${startDate} to ${endDate}`}
            </p>
          </div>
        </div>

        {/* Pending Approvals Section */}
        {pendingEntries.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-yellow-700">Pending Approvals ({pendingEntries.length})</h3>
            <div className="space-y-3">
              {pendingEntries.map(entry => (
                <div key={entry.id} className="border border-yellow-300 bg-yellow-50 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <p><span className="font-semibold">Date:</span> {entry.date}</p>
                        <p><span className="font-semibold">Shift:</span> {entry.shift}</p>
                        <p><span className="font-semibold">Team:</span> {entry.team}</p>
                        <p><span className="font-semibold">Party:</span> {entry.partyName}</p>
                        <p><span className="font-semibold">Design:</span> {entry.designNo}</p>
                        <p><span className="font-semibold">Than:</span> {entry.thanNo}</p>
                        <p><span className="font-semibold">Quantity:</span> {entry.qtyMeters}M</p>
                        <p><span className="font-semibold">Total:</span> {entry.total}M</p>
                        <p><span className="font-semibold">Chemical:</span> {entry.chemical}</p>
                        <p className="col-span-2"><span className="font-semibold">Submitted by:</span> {entry.createdBy}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4 flex-wrap">
                      <button
                        onClick={() => openPicEdit(entry)}
                        className="flex items-center gap-1 px-3 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors text-sm"
                        title="Edit pictures"
                      >
                        🖼️
                        {(entry.referencePictures || []).length === 0 ? 'Add Pic' : 'Edit Pic'}
                      </button>
                      <button
                        onClick={() => handleApprove(entry.id)}
                        className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                      >
                        <CheckCircle size={18} />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(entry.id)}
                        className="flex items-center gap-1 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                      >
                        <XCircle size={18} />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approved Entries Section */}
        {approvedEntries.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 text-green-700">Approved Entries ({approvedEntries.length})</h3>
            <div className="space-y-2">
              {approvedEntries.map(entry => (
                <div key={entry.id} className="border border-green-300 bg-green-50 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="grid grid-cols-5 gap-2 text-sm">
                        <p><span className="font-semibold">Date:</span> {entry.date}</p>
                        <p><span className="font-semibold">Shift:</span> {entry.shift}</p>
                        <p><span className="font-semibold">Team:</span> {entry.team}</p>
                        <p><span className="font-semibold">Party:</span> {entry.partyName}</p>
                        <p><span className="font-semibold">Design:</span> {entry.designNo}</p>
                        <p><span className="font-semibold">Than:</span> {entry.thanNo}</p>
                        <p><span className="font-semibold">Quantity:</span> {entry.qtyMeters}M</p>
                        <p><span className="font-semibold">Total:</span> {entry.total}M</p>
                        <p><span className="font-semibold">Chemical:</span> {entry.chemical}</p>
                        <p className="col-span-2"><span className="font-semibold">Submitted by:</span> {entry.createdBy}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => openPicEdit(entry)}
                        className="flex items-center gap-1 px-3 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors text-sm"
                        title="Edit pictures"
                      >
                        🖼️
                        {(entry.referencePictures || []).length === 0 ? 'Add Pic' : 'Edit Pic'}
                      </button>
                      <button
                        onClick={() => handleEdit(entry)}
                        disabled={isSyncing}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Edit entry"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        disabled={isSyncing}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete entry"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Entries Message */}
        {dateRangeEntries.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Calendar size={48} className="mx-auto mb-3 text-gray-400" />
            <p className="text-lg font-medium">No entries found</p>
            <p className="text-sm">
              {startDate === endDate 
                ? `for ${startDate}` 
                : `from ${startDate} to ${endDate}`}
            </p>
          </div>
        )}
        </div>
      )}

      {/* Excel Reports Tab */}
      {activeTab === 'reports' && (
        <EnhancedReportGenerator currentUser={currentUser} />
      )}

      {activeTab === 'backup' && (
        <ManagementBackup currentUser={currentUser} apiUrl={API_URL} authHeaders={getAuthHeaders()} />
      )}

      {/* Picture Edit Modal */}
      {picEditEntry && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
          onClick={() => setPicEditEntry(null)}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>📸 Edit Pictures</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                  {picEditEntry.partyName} — {picEditEntry.designNo} — {picEditEntry.date}
                </p>
              </div>
              <button onClick={() => setPicEditEntry(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                <X size={24}/>
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
              {picEditPics.map((pic, idx) => (
                <div key={idx} style={{ position: 'relative' }}>
                  <img src={pic} alt={`Pic ${idx+1}`} style={{ width: '100%', height: '130px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #e5e7eb' }}/>
                  <button onClick={() => setPicEditPics(prev => prev.filter((_, i) => i !== idx))}
                    style={{ position: 'absolute', top: '4px', right: '4px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                    ×
                  </button>
                </div>
              ))}
              {picEditPics.length < 5 && (
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '130px', border: '2px dashed #d1d5db', borderRadius: '8px', cursor: 'pointer', color: '#9ca3af', background: '#f9fafb' }}>
                  <Plus size={24}/>
                  <span style={{ fontSize: '12px', marginTop: '4px' }}>Add Photo</span>
                  <input type="file" accept="image/*" multiple onChange={handleAddPics} style={{ display: 'none' }}/>
                </label>
              )}
            </div>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '14px' }}>{picEditPics.length}/5 pictures • Auto-compressed to 100KB</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={savePics} disabled={savingPics}
                style={{ flex: 1, padding: '12px', background: savingPics ? '#9ca3af' : 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: savingPics ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {savingPics ? 'Saving...' : '✅ Save Pictures'}
              </button>
              <button onClick={() => setPicEditEntry(null)}
                style={{ padding: '12px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Party Names Manager Modal */}
      {showPartyNamesManager && (
        <PartyNamesManager onClose={() => setShowPartyNamesManager(false)} />
      )}

      {/* Edit Entry Modal */}
      {showEditModal && editingEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Edit Production Entry</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingEntry(null);
                  }}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Date, Shift, Team */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={editingEntry.date}
                    onChange={(e) => setEditingEntry({ ...editingEntry, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shift *
                  </label>
                  <select
                    value={editingEntry.shift}
                    onChange={(e) => setEditingEntry({ ...editingEntry, shift: e.target.value as 'Day' | 'Night' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Day">Day</option>
                    <option value="Night">Night</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Team *
                  </label>
                  <select
                    value={editingEntry.team}
                    onChange={(e) => setEditingEntry({ ...editingEntry, team: e.target.value as 'A' | 'B' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                  </select>
                </div>
              </div>

              {/* Party Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Party Name *
                </label>
                <input
                  type="text"
                  value={editingEntry.partyName}
                  onChange={(e) => setEditingEntry({ ...editingEntry, partyName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter party name"
                />
              </div>

              {/* Design No, Than No */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Design No *
                  </label>
                  <input
                    type="text"
                    value={editingEntry.designNo}
                    onChange={(e) => setEditingEntry({ ...editingEntry, designNo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter design number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Than No *
                  </label>
                  <input
                    type="text"
                    value={editingEntry.thanNo}
                    onChange={(e) => setEditingEntry({ ...editingEntry, thanNo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter than number"
                  />
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity (Meters) *
                </label>
                <input
                  type="number"
                  value={editingEntry.qtyMeters}
                  onChange={(e) => {
                    const qty = parseFloat(e.target.value) || 0;
                    setEditingEntry({ 
                      ...editingEntry, 
                      qtyMeters: qty,
                      total: qty 
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter quantity"
                  step="0.01"
                />
              </div>

              {/* Chemical */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chemical (X:YYYkgs format) *
                </label>
                <input
                  type="text"
                  value={editingEntry.chemical}
                  onChange={(e) => setEditingEntry({ ...editingEntry, chemical: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 2:150kgs"
                />
              </div>

              {/* Total (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total (Meters)
                </label>
                <input
                  type="number"
                  value={editingEntry.total}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveEdit}
                  disabled={isSyncing}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
                >
                  {isSyncing ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingEntry(null);
                  }}
                  disabled={isSyncing}
                  className="flex-1 px-6 py-3 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}