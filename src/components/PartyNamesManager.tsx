import { useState, useEffect } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { API_URL, getAuthHeaders } from '../utils/supabase/info';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

// API_URL imported from utils/supabase/info

const DEFAULT_PARTY_NAMES = [
  'AA',
  'AT',
  'DF',
  'FS',
  'GC',
  'GP',
  'JB',
  'JST',
  'KE',
  'KP',
  'LV',
  'MM',
  'R',
  'RD',
  'RL',
  'S',
  'SV',
  'VE',
].sort(); // Ensure alphabetical order

interface PartyNamesManagerProps {
  onClose: () => void;
}

export function PartyNamesManager({ onClose }: PartyNamesManagerProps) {
  const [partyNames, setPartyNames] = useState<string[]>([]);
  const [newPartyName, setNewPartyName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPartyNames();
  }, []);

  const loadPartyNames = async () => {
    setIsLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_URL}/get-party-names`, {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.partyNames && data.partyNames.length > 0) {
          setPartyNames(data.partyNames);
        } else {
          // Initialize with defaults if empty
          setPartyNames([...DEFAULT_PARTY_NAMES]);
          await savePartyNames([...DEFAULT_PARTY_NAMES]);
        }
      } else {
        // Initialize with defaults on error
        setPartyNames([...DEFAULT_PARTY_NAMES]);
      }
    } catch (error) {
      console.error('Error loading party names:', error);
      setPartyNames([...DEFAULT_PARTY_NAMES]);
    } finally {
      setIsLoading(false);
    }
  };

  const savePartyNames = async (names: string[]) => {
    try {
      const response = await fetchWithTimeout(`${API_URL}/save-party-names`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ partyNames: names }),
      });

      if (!response.ok) {
        throw new Error('Failed to save party names');
      }

      return true;
    } catch (error) {
      console.error('Error saving party names:', error);
      throw error;
    }
  };

  const handleAddPartyName = async () => {
    const trimmedName = newPartyName.trim().toUpperCase();
    
    if (!trimmedName) {
      alert('Please enter a party name');
      return;
    }

    if (partyNames.includes(trimmedName)) {
      alert('This party name already exists');
      return;
    }

    setIsSaving(true);
    try {
      const updatedNames = [...partyNames, trimmedName].sort();
      await savePartyNames(updatedNames);
      setPartyNames(updatedNames);
      setNewPartyName('');
      alert('✅ Party name added successfully!');
    } catch (error) {
      alert('❌ Failed to add party name. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePartyName = async (nameToDelete: string) => {
    if (!confirm(`Are you sure you want to delete "${nameToDelete}"?`)) {
      return;
    }

    setIsSaving(true);
    try {
      const updatedNames = partyNames.filter(name => name !== nameToDelete);
      await savePartyNames(updatedNames);
      setPartyNames(updatedNames);
      alert('✅ Party name deleted successfully!');
    } catch (error) {
      alert('❌ Failed to delete party name. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!confirm('Reset to default party names? This will remove any custom party names you added.')) {
      return;
    }

    setIsSaving(true);
    try {
      await savePartyNames([...DEFAULT_PARTY_NAMES]);
      setPartyNames([...DEFAULT_PARTY_NAMES]);
      alert('✅ Reset to default party names!');
    } catch (error) {
      alert('❌ Failed to reset. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <h2 className="text-2xl font-bold">Party Names Management</h2>
          <p className="text-blue-100 mt-1">Add or remove party names available in the dropdown</p>
        </div>

        <div className="p-6">
          {/* Add New Party Name */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Add New Party Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPartyName}
                onChange={(e) => setNewPartyName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddPartyName()}
                placeholder="Enter party name (e.g., XYZ)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSaving}
              />
              <button
                onClick={handleAddPartyName}
                disabled={isSaving || !newPartyName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Plus size={20} />
                Add
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Party names will be automatically converted to uppercase
            </p>
          </div>

          {/* Current Party Names List */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-700">
                Current Party Names ({partyNames.length})
              </label>
              <button
                onClick={handleResetToDefaults}
                disabled={isSaving}
                className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:bg-gray-100"
              >
                Reset to Defaults
              </button>
            </div>
            
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">
                Loading party names...
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                {partyNames.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No party names yet. Add one above!
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-4">
                    {partyNames.map((name) => (
                      <div
                        key={name}
                        className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded px-3 py-2"
                      >
                        <span className="font-medium text-blue-900">{name}</span>
                        <button
                          onClick={() => handleDeletePartyName(name)}
                          disabled={isSaving}
                          className="text-red-600 hover:text-red-800 disabled:text-gray-400"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Information</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Party names added here will be available in the dropdown for all users</li>
              <li>• Only Admin and Management can add/remove party names</li>
              <li>• Party names are automatically sorted alphabetically</li>
              <li>• Changes are saved to the cloud and synced across all users</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
