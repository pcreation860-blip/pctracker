import React from 'react';
import { StorageErrorRecovery } from './StorageErrorRecovery';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  isStorageError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isStorageError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if it's a storage-related error
    const isStorageError = 
      error.name === 'QuotaExceededError' ||
      error.message.includes('quota') ||
      error.message.includes('localStorage') ||
      error.message.includes('storage');
    
    return {
      hasError: true,
      isStorageError
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // If it's a storage error, try to clean up
    if (this.state.isStorageError) {
      console.log('🚨 Storage error detected - attempting emergency cleanup...');
      try {
        const keysToRemove = ['productionEntries', 'electricityEntries', 'dailyReports'];
        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key);
          } catch (e) {
            // Ignore
          }
        });
      } catch (e) {
        console.error('Emergency cleanup failed:', e);
      }
    }
  }

  render() {
    if (this.state.hasError && this.state.isStorageError) {
      return <StorageErrorRecovery />;
    }

    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-4">
              The application encountered an unexpected error. Please reload the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
