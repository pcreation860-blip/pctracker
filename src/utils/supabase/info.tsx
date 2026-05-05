// PCTracker API Configuration - Updated for Cloudflare Workers

// ✅ Cloudflare Worker URL - FREE FOREVER, 5GB storage
export const CLOUDFLARE_WORKER_URL = 'https://pctracker-api.pcreation860.workers.dev';

// Supabase fallback (kept for reference)
export const projectId = "wznpdddjukkimpxikfux"
export const publicAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bnBkZGRqdWtraW1weGlrZnV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3ODExNDAsImV4cCI6MjA5MTM1NzE0MH0.sd_auvtt3WRfXg4sDGS77OUGHveelwvnFtaR1-tq04U"

// ✅ API URL now points to Cloudflare Worker
export const API_URL = CLOUDFLARE_WORKER_URL;

// ✅ No auth headers needed for Cloudflare Worker
export const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
});
