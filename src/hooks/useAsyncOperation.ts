import { useState, useCallback } from 'react';
import { parseApiError, logApiError, showErrorAlert } from '../utils/apiErrorHandler';

interface AsyncOperationState {
  isLoading: boolean;
  error: string | null;
  success: boolean;
}

interface AsyncOperationOptions {
  showAlert?: boolean;
  operationName?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

/**
 * Custom hook for managing async operations with loading, error, and success states
 */
export function useAsyncOperation() {
  const [state, setState] = useState<AsyncOperationState>({
    isLoading: false,
    error: null,
    success: false
  });

  const execute = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    options: AsyncOperationOptions = {}
  ): Promise<T | null> => {
    const { showAlert = true, operationName = 'Operation', onSuccess, onError } = options;

    setState({ isLoading: true, error: null, success: false });

    try {
      const result = await asyncFn();
      
      setState({ isLoading: false, error: null, success: true });
      
      if (onSuccess) {
        onSuccess();
      }
      
      // Auto-reset success state after 3 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, success: false }));
      }, 3000);
      
      return result;
    } catch (error) {
      const apiError = parseApiError(error);
      const errorMessage = apiError.message;
      
      logApiError(operationName, error);
      
      setState({ isLoading: false, error: errorMessage, success: false });
      
      if (showAlert) {
        showErrorAlert(apiError, operationName);
      }
      
      if (onError) {
        onError(errorMessage);
      }
      
      // Auto-clear error after 5 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, error: null }));
      }, 5000);
      
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, success: false });
  }, []);

  return {
    ...state,
    execute,
    reset
  };
}
