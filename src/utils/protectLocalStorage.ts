/**
 * Aggressive localStorage protection
 * Prevents ANY large data from being stored
 * Updated v2.1.7 - Enhanced quota error handling
 */

const MAX_ITEM_SIZE = 50 * 1024; // 50KB max per item
const BLOCKED_KEYS = [
  'productionEntries',
  'electricityEntries', 
  'dailyReports',
  'lastReportGenerated',
  'reportData', // Block any report caching
  'cachedEntries' // Block any cached entries
];

export function protectLocalStorage() {
  // Store original setItem
  const originalSetItem = localStorage.setItem.bind(localStorage);
  
  // Override setItem to block large data
  localStorage.setItem = function(key: string, value: string) {
    // Block known large keys
    if (BLOCKED_KEYS.includes(key)) {
      console.warn(`🚫 BLOCKED: Attempt to store large data in localStorage key "${key}"`);
      console.warn('   This data should be stored in cloud only.');
      return; // Silently ignore
    }
    
    // Check size
    const size = new Blob([value]).size;
    if (size > MAX_ITEM_SIZE) {
      console.warn(`🚫 BLOCKED: Attempt to store ${(size / 1024).toFixed(2)}KB in localStorage key "${key}"`);
      console.warn(`   Maximum allowed: ${(MAX_ITEM_SIZE / 1024).toFixed(2)}KB`);
      return; // Silently ignore
    }
    
    // Allow small items
    try {
      originalSetItem(key, value);
    } catch (error) {
      console.error(`❌ Failed to save to localStorage (${key}):`, error);
      
      // If quota exceeded, try emergency cleanup
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.log('🚨 Quota exceeded - attempting emergency cleanup...');
        BLOCKED_KEYS.forEach(k => {
          try {
            localStorage.removeItem(k);
            console.log(`   Removed: ${k}`);
          } catch (e) {
            // Ignore
          }
        });
        
        // Try one more time
        try {
          originalSetItem(key, value);
          console.log('✅ Saved after emergency cleanup');
        } catch (retryError) {
          console.error('❌ Still failed after cleanup');
        }
      }
    }
  };
  
  console.log('🛡️ localStorage protection enabled');
  console.log(`   - Blocked keys: ${BLOCKED_KEYS.join(', ')}`);
  console.log(`   - Max item size: ${(MAX_ITEM_SIZE / 1024).toFixed(2)}KB`);
}
