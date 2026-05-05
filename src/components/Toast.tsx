import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const toastStyles = {
  success: {
    icon: CheckCircle,
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    iconColor: 'text-green-600'
  },
  error: {
    icon: XCircle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    iconColor: 'text-red-600'
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    iconColor: 'text-yellow-600'
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    iconColor: 'text-blue-600'
  }
};

function ToastItem({ toast, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const style = toastStyles[toast.type];
  const Icon = style.icon;

  useEffect(() => {
    const duration = toast.duration || 5000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onClose(toast.id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(toast.id), 300);
  };

  return (
    <div
      className={`
        ${style.bg} ${style.border} border rounded-lg shadow-lg p-4 mb-3
        flex items-start gap-3 min-w-[300px] max-w-md
        transition-all duration-300
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
      `}
    >
      <Icon className={`${style.iconColor} flex-shrink-0 mt-0.5`} size={20} />
      <p className={`${style.text} flex-1 text-sm font-medium leading-relaxed`}>
        {toast.message}
      </p>
      <button
        onClick={handleClose}
        className={`${style.text} hover:opacity-70 transition-opacity flex-shrink-0`}
      >
        <X size={18} />
      </button>
    </div>
  );
}

// Toast container component
export function ToastContainer({ toasts, onClose }: { 
  toasts: Toast[]; 
  onClose: (id: string) => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}

// Toast manager hook
let toastCounter = 0;
const toastListeners: ((toasts: Toast[]) => void)[] = [];
let currentToasts: Toast[] = [];

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    toastListeners.push(setToasts);
    return () => {
      const index = toastListeners.indexOf(setToasts);
      if (index > -1) {
        toastListeners.splice(index, 1);
      }
    };
  }, []);

  const removeToast = (id: string) => {
    currentToasts = currentToasts.filter(t => t.id !== id);
    toastListeners.forEach(listener => listener([...currentToasts]));
  };

  return { toasts, removeToast };
}

// Global toast functions
export const toast = {
  success: (message: string, duration?: number) => {
    const id = `toast-${++toastCounter}`;
    currentToasts = [...currentToasts, { id, type: 'success', message, duration }];
    toastListeners.forEach(listener => listener([...currentToasts]));
  },
  error: (message: string, duration?: number) => {
    const id = `toast-${++toastCounter}`;
    currentToasts = [...currentToasts, { id, type: 'error', message, duration }];
    toastListeners.forEach(listener => listener([...currentToasts]));
  },
  warning: (message: string, duration?: number) => {
    const id = `toast-${++toastCounter}`;
    currentToasts = [...currentToasts, { id, type: 'warning', message, duration }];
    toastListeners.forEach(listener => listener([...currentToasts]));
  },
  info: (message: string, duration?: number) => {
    const id = `toast-${++toastCounter}`;
    currentToasts = [...currentToasts, { id, type: 'info', message, duration }];
    toastListeners.forEach(listener => listener([...currentToasts]));
  }
};
