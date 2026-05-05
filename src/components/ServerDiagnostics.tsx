import { useState } from 'react';
import { Activity, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { API_URL, getAuthHeaders } from '../utils/supabase/info';

// API_URL imported from utils/supabase/info

interface DiagnosticResult {
  test: string;
  status: 'pending' | 'success' | 'error' | 'timeout';
  duration?: number;
  message?: string;
  details?: any;
}

export function ServerDiagnostics() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const newResults: DiagnosticResult[] = [];

    // Test 1: Health Check
    try {
      const start = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_URL}/health`, {
        headers: { ...getAuthHeaders() },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const duration = Date.now() - start;
      if (response.ok) {
        const data = await response.json();
        newResults.push({
          test: 'Health Check',
          status: 'success',
          duration,
          details: data,
        });
      } else {
        newResults.push({
          test: 'Health Check',
          status: 'error',
          duration,
          message: `HTTP ${response.status}`,
        });
      }
    } catch (error) {
      newResults.push({
        test: 'Health Check',
        status: error.name === 'AbortError' ? 'timeout' : 'error',
        message: error.message,
      });
    }
    setResults([...newResults]);

    // Test 2: Fetch Production Entries
    try {
      const start = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${API_URL}/production-entries`, {
        headers: { ...getAuthHeaders() },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const duration = Date.now() - start;
      if (response.ok) {
        const data = await response.json();
        newResults.push({
          test: 'Fetch Production Entries',
          status: 'success',
          duration,
          details: { count: data.length, sizeKB: Math.round(JSON.stringify(data).length / 1024) },
        });
      } else {
        const errorText = await response.text();
        newResults.push({
          test: 'Fetch Production Entries',
          status: 'error',
          duration,
          message: `HTTP ${response.status}`,
          details: errorText,
        });
      }
    } catch (error) {
      newResults.push({
        test: 'Fetch Production Entries',
        status: error.name === 'AbortError' ? 'timeout' : 'error',
        message: error.message,
      });
    }
    setResults([...newResults]);

    // Test 3: Fetch Electricity Entries
    try {
      const start = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${API_URL}/electricity-entries`, {
        headers: { ...getAuthHeaders() },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const duration = Date.now() - start;
      if (response.ok) {
        const data = await response.json();
        newResults.push({
          test: 'Fetch Electricity Entries',
          status: 'success',
          duration,
          details: { count: data.length, sizeKB: Math.round(JSON.stringify(data).length / 1024) },
        });
      } else {
        newResults.push({
          test: 'Fetch Electricity Entries',
          status: 'error',
          duration,
          message: `HTTP ${response.status}`,
        });
      }
    } catch (error) {
      newResults.push({
        test: 'Fetch Electricity Entries',
        status: error.name === 'AbortError' ? 'timeout' : 'error',
        message: error.message,
      });
    }
    setResults([...newResults]);

    setIsRunning(false);
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl p-4 max-w-md border-2 border-gray-200 z-50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="text-blue-600" size={20} />
          <h3 className="font-bold text-gray-900">Server Diagnostics</h3>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={isRunning}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
        >
          <RefreshCw size={14} className={isRunning ? 'animate-spin' : ''} />
          {isRunning ? 'Running...' : 'Run Tests'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2 mt-3">
          {results.map((result, index) => (
            <div
              key={index}
              className={`p-2 rounded text-sm border ${
                result.status === 'success'
                  ? 'bg-green-50 border-green-200'
                  : result.status === 'error'
                  ? 'bg-red-50 border-red-200'
                  : result.status === 'timeout'
                  ? 'bg-orange-50 border-orange-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {result.status === 'success' ? (
                    <CheckCircle size={16} className="text-green-600" />
                  ) : result.status === 'error' ? (
                    <AlertCircle size={16} className="text-red-600" />
                  ) : result.status === 'timeout' ? (
                    <AlertCircle size={16} className="text-orange-600" />
                  ) : (
                    <RefreshCw size={16} className="text-gray-400 animate-spin" />
                  )}
                  <span className="font-medium">{result.test}</span>
                </div>
                {result.duration && (
                  <span className="text-xs text-gray-600">{result.duration}ms</span>
                )}
              </div>
              {result.message && (
                <p className="text-xs text-gray-700 mt-1 ml-6">{result.message}</p>
              )}
              {result.details && (
                <pre className="text-xs text-gray-600 mt-1 ml-6 overflow-x-auto">
                  {JSON.stringify(result.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
