import { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, RefreshCw, Activity } from 'lucide-react';
import { API_URL, getAuthHeaders } from '../utils/supabase/info';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

interface RecentEntry {
  id: string;
  date: string;
  partyName?: string;
  designNo?: string;
  thanNo?: string;
  qtyMeters?: number;
  chemical?: string;
  colors?: string;
  team?: string;
  shift?: string;
  createdBy?: string;
  approved?: boolean;
  timestamp?: string;
}

interface RecentActivityProps {
  currentUser?: { role?: string; username?: string };
}

// API_URL imported from utils/supabase/info (Cloudflare Worker)

// SAFE number helper — prevents "Cannot read properties of undefined (reading 'toFixed')"
// This was the crash cause: calling .toFixed() on undefined/null values
const safeNum = (val: any, decimals = 2): string => {
  const n = Number(val);
  return isNaN(n) ? '0.' + '0'.repeat(decimals) : n.toFixed(decimals);
};

const safeStr = (val: any, fallback = '—'): string => {
  if (val === null || val === undefined || val === '') return fallback;
  return String(val);
};

export function RecentActivity({ currentUser }: RecentActivityProps) {
  const [entries, setEntries] = useState<RecentEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchRecentEntries = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Try /recent-entries endpoint first, fall back to /production-entries
      let response = await fetchWithTimeout(
        `${API_URL}/recent-entries?limit=20`,
        {
          headers: {  },
          timeout: 35000,
          retries: 0,
        }
      );

      // Fallback: if recent-entries not found, use production-entries with today's date
      if (!response.ok && response.status === 404) {
        const today = new Date().toISOString().split('T')[0];
        response = await fetchWithTimeout(
          `${API_URL}/production-entries?limit=20&offset=0&startDate=${today}&endDate=${today}`,
          {
            headers: {  },
            timeout: 35000,
            retries: 0,
          }
        );
      }

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      // Handle both response formats safely
      let fetchedEntries: RecentEntry[] = [];
      if (Array.isArray(data)) {
        fetchedEntries = data;
      } else if (data?.entries && Array.isArray(data.entries)) {
        fetchedEntries = data.entries;
      } else {
        fetchedEntries = [];
      }

      // FIX: Sanitize every entry before storing — ensure no undefined numeric fields
      const sanitized = fetchedEntries.map((entry: any) => ({
        ...entry,
        qtyMeters: entry?.qtyMeters !== undefined ? Number(entry.qtyMeters) || 0 : 0,
        approved: Boolean(entry?.approved),
        partyName: entry?.partyName || '',
        designNo: entry?.designNo || '',
        thanNo: entry?.thanNo || '',
        team: entry?.team || '',
        shift: entry?.shift || '',
        createdBy: entry?.createdBy || '',
        colors: entry?.colors || '',
        chemical: entry?.chemical || '',
        date: entry?.date || '',
        timestamp: entry?.timestamp || '',
      }));

      setEntries(sanitized);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error('Error loading recent entries:', err.message);
      setError(`Error loading recent entries: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentEntries();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="text-blue-500 animate-pulse" size={24} />
          <h3 className="text-lg font-bold">Recent Activity</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity className="text-red-500" size={24} />
            <h3 className="text-lg font-bold">Recent Activity</h3>
          </div>
          <button
            onClick={fetchRecentEntries}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Activity className="text-blue-500" size={24} />
          <h3 className="text-lg font-bold">Recent Activity</h3>
          {lastUpdated && (
            <span className="text-xs text-gray-400">Updated {lastUpdated}</span>
          )}
        </div>
        <button
          onClick={fetchRecentEntries}
          className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Clock size={40} className="mx-auto mb-2 opacity-30" />
          <p>No recent entries found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {entry.approved ? (
                      <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle size={16} className="text-yellow-500 flex-shrink-0" />
                    )}
                    <span className="font-semibold text-sm">
                      {safeStr(entry.partyName, 'Unknown Party')}
                    </span>
                    <span className="text-xs text-gray-400">
                      {safeStr(entry.date)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 mt-1">
                    <span>Design: {safeStr(entry.designNo)}</span>
                    <span>Than: {safeStr(entry.thanNo)}</span>
                    {/* FIX: Use safeNum() — was crashing with .toFixed() on undefined */}
                    <span>Qty: {safeNum(entry.qtyMeters, 2)} M</span>
                    <span>Table: {safeStr(entry.team)}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>Shift: {safeStr(entry.shift)}</span>
                    <span>By: {safeStr(entry.createdBy)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      entry.approved
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {entry.approved ? 'Approved' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
