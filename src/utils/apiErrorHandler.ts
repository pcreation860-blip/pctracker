/**
 * Centralized API error handling utility
 * Provides consistent error messages and logging
 */

export interface ApiError {
  message: string;
  status?: number;
  details?: string;
  isTimeout?: boolean;
  isNetworkError?: boolean;
}

/**
 * Parse and format API errors for user-friendly display
 */
export function parseApiError(error: unknown): ApiError {
  // Handle timeout errors
  if (error instanceof Error && error.message.includes('timeout')) {
    return {
      message: 'Request timed out. The server is taking too long to respond.',
      isTimeout: true,
      details: error.message
    };
  }

  // Handle network errors
  if (error instanceof Error && (
    error.message.includes('fetch') ||
    error.message.includes('network') ||
    error.message.includes('Failed to fetch')
  )) {
    return {
      message: 'Network error. Please check your internet connection.',
      isNetworkError: true,
      details: error.message
    };
  }

  // Handle HTTP errors with status codes
  if (error instanceof Response) {
    return {
      message: `Server error: ${error.status} ${error.statusText}`,
      status: error.status,
      details: error.statusText
    };
  }

  // Handle generic errors
  if (error instanceof Error) {
    return {
      message: error.message,
      details: error.stack
    };
  }

  // Unknown error type
  return {
    message: 'An unexpected error occurred',
    details: String(error)
  };
}

/**
 * Log API errors with context
 */
export function logApiError(
  operation: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  const parsedError = parseApiError(error);
  
  console.error(`❌ API Error during ${operation}:`, {
    ...parsedError,
    context,
    timestamp: new Date().toISOString()
  });
  
  return parsedError;
}

/**
 * Show user-friendly error alerts
 */
export function showErrorAlert(error: ApiError, operation?: string) {
  const prefix = operation ? `${operation}: ` : '';
  
  if (error.isTimeout) {
    alert(`${prefix}Request timed out. Please try again.`);
  } else if (error.isNetworkError) {
    alert(`${prefix}Network error. Please check your connection and try again.`);
  } else if (error.status && error.status >= 500) {
    alert(`${prefix}Server error. Please try again later or contact support.`);
  } else if (error.status === 404) {
    alert(`${prefix}Resource not found.`);
  } else if (error.status === 403 || error.status === 401) {
    alert(`${prefix}Access denied. Please check your permissions.`);
  } else {
    alert(`${prefix}${error.message}`);
  }
}
