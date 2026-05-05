import { useState, useEffect } from 'react';
import { Bell, AlertCircle, TrendingDown, X } from 'lucide-react';
import { API_URL, getAuthHeaders } from '../utils/supabase/info';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

interface Notification {
  id: string;
  type: 'pending-approvals' | 'low-production';
  message: string;
  count?: number;
  date: string;
  dismissed: boolean;
}

// API_URL imported from utils/supabase/info (Cloudflare Worker)

interface AdminNotificationsProps {
  onNotificationCountChange?: (count: number) => void;
}

export function AdminNotifications({ onNotificationCountChange }: AdminNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);
  const [todayStats, setTodayStats] = useState<{
    totalProduction: number;
    pendingCount: number;
    approvedCount: number;
  } | null>(null);

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        setBrowserNotificationsEnabled(permission === 'granted');
      });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      setBrowserNotificationsEnabled(true);
    }
  }, []);

  // Check for notifications
  const checkNotifications = async () => {
    setIsChecking(true);
    try {
      // Get today's date
      const today = new Date().toISOString().split('T')[0];

      // Fetch production entries with date filter for better performance
      // FIX: was raw fetch() with no timeout — caused server hanging and broken pipe errors
      const response = await fetchWithTimeout(`${API_URL}/production-entries?startDate=${today}&endDate=${today}&limit=200`, {
        headers: {  },
        timeout: 35000,
        retries: 0,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch production entries');
      }

      const data = await response.json();
      const entries = data.entries || [];

      // All entries are from today due to date filter
      const todayEntries = entries;

      // Check for pending approvals
      const pendingEntries = todayEntries.filter((entry: any) => !entry.approved);
      const approvedEntries = todayEntries.filter((entry: any) => entry.approved);
      
      // Calculate total production for today
      const totalProduction = approvedEntries
        .reduce((sum: number, entry: any) => sum + (entry.qtyMeters || 0), 0);

      // Update stats
      setTodayStats({
        totalProduction,
        pendingCount: pendingEntries.length,
        approvedCount: approvedEntries.length,
      });

      const newNotifications: Notification[] = [];

      // Add pending approval notification
      if (pendingEntries.length > 0) {
        const existingNotif = notifications.find(
          n => n.type === 'pending-approvals' && n.date === today && !n.dismissed
        );
        
        if (!existingNotif) {
          newNotifications.push({
            id: `pending-${today}`,
            type: 'pending-approvals',
            message: `${pendingEntries.length} production ${pendingEntries.length === 1 ? 'entry' : 'entries'} pending approval`,
            count: pendingEntries.length,
            date: today,
            dismissed: false,
          });
        }
      }

      // Add low production notification (only after 6 PM)
      const currentHour = new Date().getHours();
      if (currentHour >= 18 && totalProduction < 300) {
        const existingNotif = notifications.find(
          n => n.type === 'low-production' && n.date === today && !n.dismissed
        );
        
        if (!existingNotif) {
          newNotifications.push({
            id: `low-prod-${today}`,
            type: 'low-production',
            message: `Today's production is only ${totalProduction.toFixed(2)} meters (target: 300m)`,
            count: totalProduction,
            date: today,
            dismissed: false,
          });
        }
      }

      // Update notifications
      if (newNotifications.length > 0) {
        setNotifications(prev => {
          const filtered = prev.filter(n => n.date === today || !n.dismissed);
          return [...filtered, ...newNotifications];
        });

        // Send browser notifications and play sound for new alerts (only if it's 11:59 PM or later)
        const currentHour = new Date().getHours();
        const currentMinute = new Date().getMinutes();
        if (currentHour === 23 && currentMinute === 59) {
          // Send browser notifications
          if (browserNotificationsEnabled && 'Notification' in window) {
            newNotifications.forEach(notif => {
              new Notification('Production Tracking Alert', {
                body: notif.message,
                icon: '/favicon.ico',
                tag: notif.id,
                requireInteraction: true,
              });
            });
          }

          // Create a simple beep sound
          try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
          } catch (error) {
            console.log('Could not play notification sound:', error);
          }
        }
      }

      setLastCheckTime(new Date().toISOString());
    } catch (error) {
      console.error('Error checking notifications:', error.message);
      // Don't crash the whole app if notifications fail
    } finally {
      setIsChecking(false);
    }
  };

  // Dismiss notification
  const dismissNotification = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, dismissed: true } : n)
    );
  };

  // Load notifications from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('admin_notifications');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Only load notifications from today
        const today = new Date().toISOString().split('T')[0];
        const todayNotifs = parsed.filter((n: Notification) => n.date === today);
        setNotifications(todayNotifs);
      } catch (error) {
        console.error('Error loading notifications:', error);
      }
    }
  }, []);

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    if (notifications.length > 0) {
      try {
        localStorage.setItem('admin_notifications', JSON.stringify(notifications));
      } catch (error) {
        console.error('Failed to save notifications to localStorage:', error);
        // Continue without saving - notifications will regenerate
      }
    }
  }, [notifications]);

  // Check at 11:59 PM daily and periodically during the day
  useEffect(() => {
    // Initial check on mount
    checkNotifications();

    // Check every minute to catch exact times
    const interval = setInterval(() => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Check at 11:59 PM (critical time)
      if (hours === 23 && minutes === 59) {
        console.log('🔔 11:59 PM - Running critical daily check');
        checkNotifications();
      }
      // Also check every 15 minutes during business hours (8 AM - 11 PM)
      else if (hours >= 8 && hours <= 23 && minutes % 15 === 0) {
        checkNotifications();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  // Filter active (non-dismissed) notifications
  const activeNotifications = notifications.filter(n => !n.dismissed);

  // Notify parent of count changes
  useEffect(() => {
    if (onNotificationCountChange) {
      onNotificationCountChange(activeNotifications.length);
    }
  }, [activeNotifications.length, onNotificationCountChange]);

  if (activeNotifications.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <p className="text-green-700 font-medium">✅ No alerts - All systems normal!</p>
        {lastCheckTime && (
          <p className="text-xs text-green-600 mt-1">
            Last checked: {new Date(lastCheckTime).toLocaleTimeString()}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-3">
      {/* Today's Stats Summary */}
      {todayStats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-600 font-medium">Today's Production</div>
            <div className="text-2xl font-bold text-blue-900 mt-1">
              {todayStats.totalProduction.toFixed(2)} m
            </div>
            <div className={`text-xs mt-1 ${todayStats.totalProduction >= 300 ? 'text-green-600' : 'text-red-600'}`}>
              Target: 300m {todayStats.totalProduction >= 300 ? '✅' : '⚠️'}
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-sm text-yellow-600 font-medium">Pending Approval</div>
            <div className="text-2xl font-bold text-yellow-900 mt-1">
              {todayStats.pendingCount}
            </div>
            <div className="text-xs text-yellow-600 mt-1">
              {todayStats.pendingCount === 0 ? 'All clear' : 'Needs attention'}
            </div>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-600 font-medium">Approved Entries</div>
            <div className="text-2xl font-bold text-green-900 mt-1">
              {todayStats.approvedCount}
            </div>
            <div className="text-xs text-green-600 mt-1">
              Successfully processed
            </div>
          </div>
        </div>
      )}

      {/* Notification Header */}
      <div className="flex items-center gap-2 text-lg font-semibold text-gray-800 mt-6">
        <Bell className={activeNotifications.length > 0 ? "text-orange-500 animate-pulse" : "text-gray-400"} size={24} />
        <span>Active Alerts</span>
        {lastCheckTime && (
          <span className="text-xs text-gray-500 font-normal ml-auto">
            Last checked: {new Date(lastCheckTime).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Notifications */}
      {activeNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`p-4 rounded-lg shadow-md border-l-4 ${
            notification.type === 'pending-approvals'
              ? 'bg-yellow-50 border-yellow-500'
              : 'bg-red-50 border-red-500'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {notification.type === 'pending-approvals' ? (
                <AlertCircle className="text-yellow-600" size={24} />
              ) : (
                <TrendingDown className="text-red-600" size={24} />
              )}
            </div>
            
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-1">
                {notification.type === 'pending-approvals'
                  ? '⚠️ Pending Approvals'
                  : '📉 Low Production Alert'}
              </h4>
              <p className="text-gray-700">{notification.message}</p>
              <p className="text-xs text-gray-500 mt-1">
                Date: {new Date(notification.date).toLocaleDateString()}
              </p>
            </div>

            <button
              onClick={() => dismissNotification(notification.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              title="Dismiss notification"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      ))}

      {/* Manual Refresh Button */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-600">
          <p className="font-semibold mb-1">🕐 Automated Checks:</p>
          <ul className="list-disc list-inside space-y-0.5 text-gray-500">
            <li>11:59 PM daily (critical)</li>
            <li>Every 15 minutes (8 AM - 11 PM)</li>
          </ul>
        </div>
        <button
          onClick={checkNotifications}
          disabled={isChecking}
          className="text-sm px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isChecking ? 'Checking...' : 'Check Now'}
        </button>
      </div>
    </div>
  );
}