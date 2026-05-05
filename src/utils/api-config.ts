// PCTracker API Configuration
// Change CLOUDFLARE_WORKER_URL after deploying your Cloudflare Worker

// Your Cloudflare Worker URL will look like:
// https://pctracker.YOUR-SUBDOMAIN.workers.dev
// After deploying, replace the URL below

export const API_BASE_URL = 'https://pctracker-api.YOUR-SUBDOMAIN.workers.dev';

// No auth token needed for Cloudflare Workers - it's built into the Worker itself!
export const API_HEADERS = {
  'Content-Type': 'application/json',
};
