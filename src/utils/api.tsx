import { API_URL, getAuthHeaders } from './supabase/info';
import type { ProductionEntry, ElectricityEntry } from '../App';

// API_URL imported from utils/supabase/info

// FIX: Client timeout must be LONGER than server's 25s so we can catch and handle errors cleanly
const AGGRESSIVE_TIMEOUT = 35000;

// Fetch with aggressive timeout and keep-alive
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = AGGRESSIVE_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      // GODMODE: Add keep-alive and compression hints
      headers: {
        ...options.headers,
        'Connection': 'keep-alive',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// GODMODE: Fast retry with minimal backoff
async function fetchWithRetry(
  url: string, 
  options: RequestInit = {}, 
  maxRetries: number = 3, // Increased from 2
  timeoutMs: number = AGGRESSIVE_TIMEOUT
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🚀 [GODMODE] API Request (attempt ${attempt + 1}/${maxRetries + 1}): ${url}`);
      const startTime = Date.now();
      const response = await fetchWithTimeout(url, options, timeoutMs);
      const duration = Date.now() - startTime;
      console.log(`✅ [GODMODE] API Response: ${response.status} (${duration}ms)`);
      return response;
    } catch (error) {
      console.warn(`⚠️ [GODMODE] Failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.message.includes('400') || error.message.includes('401') || error.message.includes('404')) {
        throw error;
      }
      
      // GODMODE: Faster retry with minimal backoff (500ms base)
      if (attempt < maxRetries) {
        const delay = Math.min(500 * Math.pow(1.5, attempt), 2000); // 500ms, 750ms, 1125ms
        console.log(`⏳ [GODMODE] Fast retry in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Request failed after all retries');
}

// Production Entries API
export const productionAPI = {
  async getAll(): Promise<ProductionEntry[]> {
    // FIX: Paginate through ALL pages so no entries are ever missed.
    // Old code fetched only offset=0 limit=500 — anything beyond entry 500 was invisible.
    const PAGE_SIZE = 200;
    const allEntries: ProductionEntry[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await fetchWithRetry(
        `${API_URL}/production-entries?limit=${PAGE_SIZE}&offset=${offset}`,
        { headers: { ...getAuthHeaders() } },
        1, // FIX: max 1 retry — retrying timeouts floods the server
        AGGRESSIVE_TIMEOUT
      );

      if (!response.ok) {
        if (response.status === 408) {
          const errorData = await response.json();
          console.error('🔥 Server timeout:', errorData);
          throw new Error(`Server timeout: ${errorData.suggestion || 'Dataset too large'}`);
        }
        throw new Error('Failed to fetch production entries');
      }

      const data = await response.json();
      let pageEntries: ProductionEntry[] = [];

      if (Array.isArray(data)) {
        pageEntries = data;
        hasMore = false;
      } else if (data.entries && Array.isArray(data.entries)) {
        pageEntries = data.entries;
        hasMore = data.hasMore === true;
        console.log(`📊 Page offset=${offset}: ${pageEntries.length} entries (total=${data.total}, hasMore=${hasMore})`);
      } else {
        console.error('Unexpected response format:', data);
        hasMore = false;
      }

      allEntries.push(...pageEntries);
      offset += PAGE_SIZE;
      if (pageEntries.length === 0) hasMore = false;
    }

    console.log(`✅ productionAPI.getAll() → ${allEntries.length} total entries fetched`);
    return allEntries;
  },

  async create(entry: ProductionEntry): Promise<void> {
    const response = await fetchWithRetry(`${API_URL}/production-entries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(entry),
    });
    if (!response.ok) throw new Error('Failed to create production entry');
  },

  async update(id: string, entry: ProductionEntry): Promise<void> {
    const response = await fetchWithRetry(`${API_URL}/production-entries/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(entry),
    });
    if (!response.ok) throw new Error('Failed to update production entry');
  },

  async delete(id: string): Promise<void> {
    const response = await fetchWithRetry(`${API_URL}/production-entries/${id}`, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!response.ok) throw new Error('Failed to delete production entry');
  },

  async bulkCreate(entries: ProductionEntry[]): Promise<void> {
    const response = await fetchWithRetry(`${API_URL}/production-entries/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(entries),
    });
    if (!response.ok) throw new Error('Failed to bulk create production entries');
  },
};

// Electricity Entries API
export const electricityAPI = {
  async getAll(): Promise<ElectricityEntry[]> {
    const response = await fetchWithRetry(`${API_URL}/electricity-entries`, {
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!response.ok) throw new Error('Failed to fetch electricity entries');
    return response.json();
  },

  async create(entry: ElectricityEntry): Promise<void> {
    const response = await fetchWithRetry(`${API_URL}/electricity-entries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(entry),
    });
    if (!response.ok) throw new Error('Failed to create electricity entry');
  },

  async update(id: string, entry: ElectricityEntry): Promise<void> {
    const response = await fetchWithRetry(`${API_URL}/electricity-entries/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(entry),
    });
    if (!response.ok) throw new Error('Failed to update electricity entry');
  },

  async delete(id: string): Promise<void> {
    const response = await fetchWithRetry(`${API_URL}/electricity-entries/${id}`, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!response.ok) throw new Error('Failed to delete electricity entry');
  },

  async bulkCreate(entries: ElectricityEntry[]): Promise<void> {
    const response = await fetchWithRetry(`${API_URL}/electricity-entries/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(entries),
    });
    if (!response.ok) throw new Error('Failed to bulk create electricity entries');
  },
};