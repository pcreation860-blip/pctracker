import { AlertTriangle, RefreshCw, Server } from 'lucide-react';

interface ServerErrorNoticeProps {
  error: string;
  onRetry: () => void;
}

export function ServerErrorNotice({ error, onRetry }: ServerErrorNoticeProps) {
  const isTimeout = error.toLowerCase().includes('timeout');
  const isConnectionError = error.toLowerCase().includes('connection') || error.toLowerCase().includes('closed');
  
  return (
    <div className="max-w-2xl mx-auto mt-8 p-6 bg-red-50 border-2 border-red-200 rounded-lg">
      <div className="flex items-start gap-4">
        <div className="bg-red-100 p-3 rounded-full">
          {isConnectionError ? (
            <Server className="text-red-600" size={24} />
          ) : (
            <AlertTriangle className="text-red-600" size={24} />
          )}
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-bold text-red-900 mb-2">
            {isTimeout ? 'Server Timeout' : 'Server Connection Error'}
          </h3>
          
          <p className="text-red-800 mb-4">
            {isTimeout ? (
              'The server is taking too long to respond. This usually happens when there is a lot of data to load.'
            ) : isConnectionError ? (
              'The connection to the server was interrupted. The server may be overloaded or restarting.'
            ) : (
              'Unable to connect to the server. Please check your internet connection.'
            )}
          </p>
          
          <div className="bg-white rounded p-3 mb-4 border border-red-200">
            <p className="text-sm text-gray-700 font-mono">{error}</p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-semibold text-red-900 text-sm">What to try:</h4>
            <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
              <li>Wait a few seconds and retry</li>
              <li>Check your internet connection</li>
              <li>Refresh the page if problem persists</li>
              {isTimeout && <li>Contact admin if you have very large datasets</li>}
            </ul>
          </div>
          
          <button
            onClick={onRetry}
            className="mt-4 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
          >
            <RefreshCw size={18} />
            Retry Connection
          </button>
        </div>
      </div>
    </div>
  );
}
