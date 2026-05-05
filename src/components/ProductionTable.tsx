import { useState, useRef } from 'react';
import { Trash2, Eye, Calendar, CheckCircle, Clock, ImagePlus, X, Plus, Pencil } from 'lucide-react';
import type { ProductionEntry, User } from '../App';
import { isEntryLocked } from '../App';
import { API_URL, getAuthHeaders } from '../utils/supabase/info';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

interface ProductionTableProps {
  entries: ProductionEntry[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, entry: ProductionEntry) => void;
  currentUser: User;
}

// Compress image to under 100KB
const compressImage = (file: File, maxKB = 100): Promise<string> => {
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
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        let quality = 0.6;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > maxKB * 1024 * 1.37 && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export function ProductionTable({ entries, onDelete, onUpdate, currentUser }: ProductionTableProps) {
  const [selectedEntry, setSelectedEntry] = useState<ProductionEntry | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [editingPictures, setEditingPictures] = useState(false);
  const [editPics, setEditPics] = useState<string[]>([]);
  const [savingPics, setSavingPics] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredEntries = filterDate
    ? entries.filter(entry => entry.date === filterDate)
    : entries;

  const sortedEntries = [...filteredEntries].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const getDayTotal = (date: string) =>
    entries.filter(e => e.date === date).reduce((sum, e) => sum + e.total, 0);

  const groupedByDate = sortedEntries.reduce((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = [];
    acc[entry.date].push(entry);
    return acc;
  }, {} as Record<string, ProductionEntry[]>);

  const canDelete = (entry: ProductionEntry) => {
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'management') return true;
    return entry.createdBy === currentUser.username && !entry.approved;
  };

  // Can edit pictures: admin always, others only if not locked
  const canEditPictures = (entry: ProductionEntry) => {
    if (currentUser.role === 'admin') return true;
    return !isEntryLocked(entry.date, currentUser.role);
  };

  const openPictureEditor = (entry: ProductionEntry) => {
    setSelectedEntry(entry);
    setEditPics([...entry.referencePictures]);
    setEditingPictures(true);
  };

  const handleAddPicture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    if (editPics.length + files.length > 5) {
      alert('Maximum 5 pictures per entry');
      return;
    }
    for (const file of Array.from(files)) {
      const compressed = await compressImage(file, 100);
      setEditPics(prev => [...prev, compressed]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePicture = (idx: number) => {
    setEditPics(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSavePictures = async () => {
    if (!selectedEntry) return;
    setSavingPics(true);
    try {
      const updatedEntry = { ...selectedEntry, referencePictures: editPics };
      await fetchWithTimeout(`${API_URL}/production-entries/${selectedEntry.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedEntry),
        timeout: 30000,
        retries: 1,
      });
      onUpdate(selectedEntry.id, updatedEntry);
      setSelectedEntry(updatedEntry);
      setEditingPictures(false);
      alert('✅ Pictures updated successfully!');
    } catch (err: any) {
      alert(`❌ Failed to save: ${err.message}`);
    } finally {
      setSavingPics(false);
    }
  };

  return (
    <div>
      {/* Filter */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <Calendar className="text-gray-500" size={20} />
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          {filterDate && (
            <button onClick={() => setFilterDate('')}
              className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-md">
              Clear Filter
            </button>
          )}
          <div className="ml-auto text-sm text-gray-600">
            Total Entries: {filteredEntries.length}
          </div>
        </div>
      </div>

      {/* Entries grouped by date */}
      {Object.entries(groupedByDate).map(([date, dateEntries]) => (
        <div key={date} className="mb-8">
          <div className="bg-yellow-400 px-4 py-2 rounded-t-lg">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">
                {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                })}
              </h3>
              <span className="font-semibold">Day's Total: {getDayTotal(date).toFixed(1)}</span>
            </div>
          </div>
          <div className="bg-white rounded-b-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Table','Shift','Party','Design No.','Than No.','Qty (M)','Total','Status','Pictures','Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dateEntries.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{entry.team}</td>
                      <td className="px-4 py-3 text-sm">{entry.shift}</td>
                      <td className="px-4 py-3 text-sm">{entry.partyName}</td>
                      <td className="px-4 py-3 text-sm">{entry.designNo}</td>
                      <td className="px-4 py-3 text-sm">{entry.thanNo}</td>
                      <td className="px-4 py-3 text-sm">{entry.qtyMeters}</td>
                      <td className="px-4 py-3 text-sm font-medium">{entry.total}</td>
                      <td className="px-4 py-3 text-sm">
                        {entry.approved
                          ? <span className="flex items-center gap-1 text-green-600"><CheckCircle size={16}/>Approved</span>
                          : <span className="flex items-center gap-1 text-yellow-600"><Clock size={16}/>Pending</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {entry.referencePictures.length > 0 && (
                            <button onClick={() => { setSelectedEntry(entry); setEditingPictures(false); }}
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-700">
                              <Eye size={16}/>
                              <span>{entry.referencePictures.length}</span>
                            </button>
                          )}
                          {/* EDIT PICTURES BUTTON - always visible for admin, visible for others if not locked */}
                          {canEditPictures(entry) && (
                            <button
                              onClick={() => openPictureEditor(entry)}
                              title="Edit pictures"
                              style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                padding: '4px 8px', borderRadius: '6px', border: 'none',
                                background: '#fef3c7', color: '#d97706',
                                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                fontFamily: 'inherit',
                              }}>
                              <ImagePlus size={14}/>
                              {entry.referencePictures.length === 0 ? 'Add Pic' : 'Edit Pic'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {canDelete(entry) && !isEntryLocked(entry.date, currentUser.role) && (
                          <button onClick={() => onDelete(entry.id)} className="text-red-600 hover:text-red-700">
                            <Trash2 size={18}/>
                          </button>
                        )}
                        {isEntryLocked(entry.date, currentUser.role) && currentUser.role !== 'admin' && (
                          <span style={{ fontSize: '11px', color: '#dc2626', background: '#fee2e2',
                            padding: '2px 6px', borderRadius: '999px' }}>🔒</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}

      {sortedEntries.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-500">No production entries found</p>
        </div>
      )}

      {/* VIEW / EDIT PICTURES MODAL */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50"
          onClick={() => { if (!editingPictures) setSelectedEntry(null); }}>
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">
                  {editingPictures ? '📸 Edit Pictures' : 'Production Details'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedEntry.partyName} — {selectedEntry.designNo} — {selectedEntry.date}
                </p>
              </div>
              <button onClick={() => { setSelectedEntry(null); setEditingPictures(false); }}
                className="text-gray-400 hover:text-gray-600">
                <X size={24}/>
              </button>
            </div>

            {/* EDIT MODE */}
            {editingPictures ? (
              <div>
                <p className="text-sm text-gray-500 mb-4">
                  Add, replace or remove pictures. Max 5 pictures, each compressed to 100KB.
                </p>

                {/* Current pictures grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {editPics.map((pic, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <img src={pic} alt={`Pic ${idx+1}`}
                        style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #e5e7eb' }}/>
                      <button
                        onClick={() => handleRemovePicture(idx)}
                        style={{
                          position: 'absolute', top: '6px', right: '6px',
                          background: '#ef4444', color: 'white', border: 'none',
                          borderRadius: '50%', width: '24px', height: '24px',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                        <X size={14}/>
                      </button>
                    </div>
                  ))}

                  {/* Add picture button */}
                  {editPics.length < 5 && (
                    <label style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', height: '140px', border: '2px dashed #d1d5db',
                      borderRadius: '8px', cursor: 'pointer', color: '#9ca3af',
                      background: '#f9fafb',
                    }}>
                      <Plus size={28}/>
                      <span style={{ fontSize: '12px', marginTop: '4px' }}>Add Photo</span>
                      <input ref={fileInputRef} type="file" accept="image/*" multiple
                        onChange={handleAddPicture} style={{ display: 'none' }}/>
                    </label>
                  )}
                </div>

                <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px' }}>
                  {editPics.length}/5 pictures
                </p>

                {/* Save buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleSavePictures} disabled={savingPics}
                    style={{
                      flex: 1, padding: '12px',
                      background: savingPics ? '#9ca3af' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: 'white', border: 'none', borderRadius: '8px',
                      fontWeight: 700, fontSize: '14px', cursor: savingPics ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                    }}>
                    {savingPics ? 'Saving...' : '✅ Save Pictures'}
                  </button>
                  <button onClick={() => setEditingPictures(false)}
                    style={{
                      padding: '12px 20px', background: '#f3f4f6', color: '#374151',
                      border: 'none', borderRadius: '8px', fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* VIEW MODE */
              <div>
                {/* Entry details */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {[
                    ['Date', selectedEntry.date],
                    ['Table', selectedEntry.team],
                    ['Shift', selectedEntry.shift],
                    ['Total (M)', selectedEntry.total],
                    ['Party Name', selectedEntry.partyName],
                    ['Design No.', selectedEntry.designNo],
                    ['Than No.', selectedEntry.thanNo],
                    ['Chemical', selectedEntry.chemical],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-gray-400 uppercase font-medium">{label}</p>
                      <p className="font-semibold text-gray-800">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Colors */}
                {selectedEntry.colors.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-400 uppercase font-medium mb-2">Colors</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedEntry.colors.map((color, i) => (
                        <span key={i} className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">{color}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pictures */}
                {selectedEntry.referencePictures.length > 0 ? (
                  <div className="mb-4">
                    <p className="text-xs text-gray-400 uppercase font-medium mb-3">
                      Reference Pictures ({selectedEntry.referencePictures.length})
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {selectedEntry.referencePictures.map((pic, i) => (
                        <img key={i} src={pic} alt={`Ref ${i+1}`}
                          className="w-full h-40 object-cover rounded-lg border border-gray-200"/>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', background: '#f9fafb', borderRadius: '8px', marginBottom: '16px' }}>
                    <ImagePlus size={28} color="#9ca3af"/>
                    <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#9ca3af' }}>No pictures attached</p>
                  </div>
                )}

                {/* Edit pictures button in view mode */}
                {canEditPictures(selectedEntry) && (
                  <button
                    onClick={() => { setEditPics([...selectedEntry.referencePictures]); setEditingPictures(true); }}
                    style={{
                      width: '100%', padding: '11px',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: 'white', border: 'none', borderRadius: '8px',
                      fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      fontFamily: 'inherit',
                    }}>
                    <Pencil size={16}/>
                    {selectedEntry.referencePictures.length === 0 ? 'Add Pictures' : 'Edit Pictures'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
