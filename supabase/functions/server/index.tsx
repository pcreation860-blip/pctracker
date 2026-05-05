import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { generateExcelWithImages } from "./excel-generator.tsx";
import { generateFastExcel } from "./fast-excel-generator.tsx";

const app = new Hono();

// Global error handler
app.onError((err, c) => {
  console.error('🔥 Global error handler caught:', err);
  return c.json({
    error: 'Internal server error',
    message: err.message,
    name: err.name,
  }, 500);
});

app.use('*', logger(console.log));

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Content-Disposition"],
    maxAge: 600,
  }),
);

// Health check
app.get("/make-server-d1b2a30f/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: performance.now()
  });
});

// ==================== SHARED CONSTANTS ====================
// FIX: Strict memory guards applied everywhere
const CHUNK_SIZE = 50;                        // entries fetched per DB round-trip
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;  // 8MB hard cap on any response payload
const SERVER_TIMEOUT_MS = 22000;              // FIX: 22s — gives 8s buffer before Supabase's 30s hard kill

// ==================== PRODUCTION ENTRIES ====================

app.get("/make-server-d1b2a30f/production-entries", async (c) => {
  const startTime = Date.now();
  const timeoutCheck = () => {
    if (Date.now() - startTime > SERVER_TIMEOUT_MS)
      throw new Error(`TIMEOUT: exceeded ${SERVER_TIMEOUT_MS}ms`);
  };

  try {
    // FIX: Default limit reduced from 500 to 200; max capped at 500
    const limit = Math.min(parseInt(c.req.query('limit') || '200'), 500);
    const offset = parseInt(c.req.query('offset') || '0');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    console.log(`📥 [GET /production-entries] limit=${limit} offset=${offset} startDate=${startDate} endDate=${endDate}`);

    const indexData = await kv.get('production_entries_index');
    if (!indexData) {
      return c.json({ entries: [], total: 0, limit, offset, hasMore: false });
    }

    const entryIds: string[] = JSON.parse(indexData);
    if (entryIds.length === 0) {
      return c.json({ entries: [], total: 0, limit, offset, hasMore: false });
    }

    // FIX: Only fetch as many IDs as pagination actually needs, not the entire dataset
    const fetchLimit = Math.min(entryIds.length, offset + limit + 100);
    const allEntries: any[] = [];

    for (let i = 0; i < fetchLimit; i += CHUNK_SIZE) {
      timeoutCheck();
      const chunkIds = entryIds.slice(i, Math.min(i + CHUNK_SIZE, fetchLimit));
      const chunkData = await kv.mget(chunkIds.map(id => `production_entry_${id}`));
      const parsed = chunkData.map(e => e ? JSON.parse(e) : null).filter(Boolean);
      allEntries.push(...parsed);

      // FIX: Abort early before OOM — check payload size after each chunk
      if (JSON.stringify(allEntries).length > MAX_RESPONSE_BYTES) {
        console.warn(`⚠️ Payload cap hit at ${allEntries.length} entries — stopping early`);
        break;
      }
    }

    timeoutCheck();

    // Filter by date range if provided
    // FIX: Compare as date strings (YYYY-MM-DD) to avoid timezone issues
    // Using string comparison is safe because ISO dates sort lexicographically
    let filtered = allEntries;
    if (startDate && endDate) {
      filtered = allEntries.filter(e => {
        if (!e.date) return true; // include entries with no date
        const entryDate = e.date.substring(0, 10); // normalize to YYYY-MM-DD
        return entryDate >= startDate && entryDate <= endDate;
      });
      console.log(`  → Date filter: ${allEntries.length} → ${filtered.length} entries (${startDate} to ${endDate})`);
    }

    // Sort newest first
    filtered.sort((a, b) => {
      const dc = new Date(b.date).getTime() - new Date(a.date).getTime();
      return dc !== 0 ? dc : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    const paginated = filtered.slice(offset, offset + limit);
    const totalTime = Date.now() - startTime;
    console.log(`✅ [GET /production-entries] Returning ${paginated.length}/${filtered.length} entries in ${totalTime}ms`);

    return c.json({
      entries: paginated,
      total: filtered.length,
      limit,
      offset,
      hasMore: offset + limit < filtered.length,
      _meta: { queryTime: totalTime, entriesReturned: paginated.length }
    }, 200, {
      'X-Response-Time': `${totalTime}ms`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ [GET /production-entries] Error after ${elapsed}ms:`, error.message);
    if (error.message.includes('TIMEOUT')) {
      return c.json({
        error: 'Request timed out. Use date filters to narrow results.',
        errorType: 'TIMEOUT',
        suggestion: '?startDate=2026-04-01&endDate=2026-04-30&limit=200'
      }, 408);
    }
    return c.json({ error: 'Failed to fetch production entries', details: error.message }, 500);
  }
});

// Create production entry
app.post("/make-server-d1b2a30f/production-entries", async (c) => {
  try {
    const entry = await c.req.json();
    const indexData = await kv.get('production_entries_index');
    const index: string[] = indexData ? JSON.parse(indexData) : [];
    index.push(entry.id);
    await kv.set(`production_entry_${entry.id}`, JSON.stringify(entry));
    await kv.set('production_entries_index', JSON.stringify(index));
    console.log(`✅ Created production entry ${entry.id}`);
    return c.json({ success: true, entry });
  } catch (error) {
    return c.json({ error: 'Failed to create production entry', details: error.message }, 500);
  }
});

// Update production entry
app.put("/make-server-d1b2a30f/production-entries/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const updatedEntry = await c.req.json();
    await kv.set(`production_entry_${id}`, JSON.stringify(updatedEntry));
    console.log(`✅ Updated production entry ${id}`);
    return c.json({ success: true, entry: updatedEntry });
  } catch (error) {
    return c.json({ error: 'Failed to update production entry', details: error.message }, 500);
  }
});

// Delete production entry
app.delete("/make-server-d1b2a30f/production-entries/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const indexData = await kv.get('production_entries_index');
    const index: string[] = indexData ? JSON.parse(indexData) : [];
    const updatedIndex = index.filter(eid => eid !== id);
    await kv.del(`production_entry_${id}`);
    await kv.set('production_entries_index', JSON.stringify(updatedIndex));
    console.log(`✅ Deleted production entry ${id}`);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to delete production entry', details: error.message }, 500);
  }
});

// Bulk create production entries
app.post("/make-server-d1b2a30f/production-entries/bulk", async (c) => {
  try {
    const entries = await c.req.json();
    const index: string[] = [];
    const keys: string[] = [];
    const values: string[] = [];
    for (const entry of entries) {
      index.push(entry.id);
      keys.push(`production_entry_${entry.id}`);
      values.push(JSON.stringify(entry));
    }
    await kv.mset(keys, values);
    await kv.set('production_entries_index', JSON.stringify(index));
    console.log(`✅ Bulk created ${entries.length} production entries`);
    return c.json({ success: true, count: entries.length });
  } catch (error) {
    return c.json({ error: 'Failed to bulk create production entries', details: error.message }, 500);
  }
});

// ==================== ELECTRICITY ENTRIES ====================

// FIX: This endpoint previously loaded ALL entries in ONE mget call with no limits.
// Now uses the same chunked fetch + memory/timeout guards as production entries.
app.get("/make-server-d1b2a30f/electricity-entries", async (c) => {
  const startTime = Date.now();
  try {
    console.log('📥 [GET /electricity-entries] Starting...');

    const indexData = await kv.get('electricity_entries_index');
    if (!indexData) return c.json([]);

    const entryIds: string[] = JSON.parse(indexData);
    if (entryIds.length === 0) return c.json([]);

    console.log(`  → ${entryIds.length} electricity entries, fetching in chunks of ${CHUNK_SIZE}`);

    const allEntries: any[] = [];

    for (let i = 0; i < entryIds.length; i += CHUNK_SIZE) {
      // Timeout guard
      if (Date.now() - startTime > SERVER_TIMEOUT_MS) {
        console.warn(`⚠️ Electricity timeout guard — stopping at ${allEntries.length} entries`);
        break;
      }

      const chunkIds = entryIds.slice(i, i + CHUNK_SIZE);
      const chunkData = await kv.mget(chunkIds.map(id => `electricity_entry_${id}`));
      const parsed = chunkData.map(e => e ? JSON.parse(e) : null).filter(Boolean);
      allEntries.push(...parsed);

      // Memory guard
      if (JSON.stringify(allEntries).length > MAX_RESPONSE_BYTES) {
        console.warn(`⚠️ Electricity payload cap hit — stopping at ${allEntries.length} entries`);
        break;
      }
    }

    console.log(`✅ [GET /electricity-entries] ${allEntries.length} entries in ${Date.now() - startTime}ms`);
    return c.json(allEntries);
  } catch (error) {
    console.error(`❌ [GET /electricity-entries] Error:`, error.message);
    return c.json({ error: 'Failed to fetch electricity entries', details: error.message }, 500);
  }
});

// Create electricity entry
app.post("/make-server-d1b2a30f/electricity-entries", async (c) => {
  try {
    const entry = await c.req.json();
    const indexData = await kv.get('electricity_entries_index');
    const index: string[] = indexData ? JSON.parse(indexData) : [];
    index.push(entry.id);
    await kv.set(`electricity_entry_${entry.id}`, JSON.stringify(entry));
    await kv.set('electricity_entries_index', JSON.stringify(index));
    console.log(`✅ Created electricity entry ${entry.id}`);
    return c.json({ success: true, entry });
  } catch (error) {
    return c.json({ error: 'Failed to create electricity entry', details: error.message }, 500);
  }
});

// Update electricity entry
app.put("/make-server-d1b2a30f/electricity-entries/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const updatedEntry = await c.req.json();
    await kv.set(`electricity_entry_${id}`, JSON.stringify(updatedEntry));
    console.log(`✅ Updated electricity entry ${id}`);
    return c.json({ success: true, entry: updatedEntry });
  } catch (error) {
    return c.json({ error: 'Failed to update electricity entry', details: error.message }, 500);
  }
});

// Delete electricity entry
app.delete("/make-server-d1b2a30f/electricity-entries/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const indexData = await kv.get('electricity_entries_index');
    const index: string[] = indexData ? JSON.parse(indexData) : [];
    const updatedIndex = index.filter(eid => eid !== id);
    await kv.del(`electricity_entry_${id}`);
    await kv.set('electricity_entries_index', JSON.stringify(updatedIndex));
    console.log(`✅ Deleted electricity entry ${id}`);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to delete electricity entry', details: error.message }, 500);
  }
});

// Bulk create electricity entries
app.post("/make-server-d1b2a30f/electricity-entries/bulk", async (c) => {
  try {
    const entries = await c.req.json();
    const index: string[] = [];
    const keys: string[] = [];
    const values: string[] = [];
    for (const entry of entries) {
      index.push(entry.id);
      keys.push(`electricity_entry_${entry.id}`);
      values.push(JSON.stringify(entry));
    }
    await kv.mset(keys, values);
    await kv.set('electricity_entries_index', JSON.stringify(index));
    console.log(`✅ Bulk created ${entries.length} electricity entries`);
    return c.json({ success: true, count: entries.length });
  } catch (error) {
    return c.json({ error: 'Failed to bulk create electricity entries', details: error.message }, 500);
  }
});


// ==================== RECENT ENTRIES ====================
// FIX: Added missing /recent-entries endpoint that RecentActivity.tsx calls
// Was returning 404 because this route never existed — causing "Error loading recent entries"
app.get("/make-server-d1b2a30f/recent-entries", async (c) => {
  const startTime = Date.now();
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    console.log(`📥 [GET /recent-entries] limit=${limit}`);

    const indexData = await kv.get('production_entries_index');
    if (!indexData) return c.json({ entries: [], total: 0 });

    const entryIds: string[] = JSON.parse(indexData);
    if (entryIds.length === 0) return c.json({ entries: [], total: 0 });

    // Fetch only the last N entries from the end of the index (newest IDs are last)
    const recentIds = entryIds.slice(-Math.min(limit * 2, 100));
    const chunkData = await kv.mget(recentIds.map(id => `production_entry_${id}`));
    const entries = chunkData.map(e => e ? JSON.parse(e) : null).filter(Boolean);

    // Sort newest first
    entries.sort((a: any, b: any) => {
      const dc = new Date(b.date).getTime() - new Date(a.date).getTime();
      return dc !== 0 ? dc : new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
    });

    const recent = entries.slice(0, limit);
    console.log(`✅ [GET /recent-entries] Returning ${recent.length} entries in ${Date.now() - startTime}ms`);
    return c.json({ entries: recent, total: entryIds.length });
  } catch (error) {
    console.error(`❌ [GET /recent-entries] Error:`, error.message);
    return c.json({ error: 'Failed to fetch recent entries', details: error.message }, 500);
  }
});

// ==================== EXCEL REPORT ====================

app.post("/make-server-d1b2a30f/generate-excel", async (c) => {
  try {
    console.log('📥 Excel generation request received');
    const requestData = await c.req.json();
    const { date, startDate, endDate, dailyData } = requestData;

    if (dailyData && startDate && endDate) {
      console.log(`🚀 Fast Excel: ${startDate} to ${endDate}, ${dailyData.length} days`);
      const excelBuffer = await generateFastExcel(requestData);
      if (!excelBuffer || excelBuffer.length === 0) throw new Error('Generated Excel buffer is empty');
      console.log(`✅ Fast Excel ready: ${excelBuffer.length} bytes`);
      return new Response(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Production_Report_${startDate}_to_${endDate}.xlsx"`,
          'Access-Control-Allow-Origin': '*',
          'Content-Length': excelBuffer.length.toString(),
        },
      });
    } else {
      console.log(`📊 Single-date Excel for: ${date}`);
      const excelBuffer = await generateExcelWithImages(requestData);
      if (!excelBuffer || excelBuffer.length === 0) throw new Error('Generated Excel buffer is empty');
      console.log(`✅ Excel ready: ${excelBuffer.length} bytes`);
      return new Response(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Production_Report_${date}.xlsx"`,
          'Access-Control-Allow-Origin': '*',
          'Content-Length': excelBuffer.length.toString(),
        },
      });
    }
  } catch (error) {
    console.error('❌ Excel generation error:', error.message);
    return c.json({ error: 'Failed to generate Excel report', details: error.message }, 500);
  }
});

// ==================== PARTY NAMES ====================

app.get("/make-server-d1b2a30f/get-party-names", async (c) => {
  try {
    const data = await kv.get('party_names');
    return c.json({ partyNames: data ? JSON.parse(data) : [] });
  } catch (error) {
    return c.json({ error: 'Failed to get party names', details: error.message }, 500);
  }
});

app.post("/make-server-d1b2a30f/save-party-names", async (c) => {
  try {
    const { partyNames } = await c.req.json();
    if (!partyNames || !Array.isArray(partyNames)) {
      return c.json({ error: 'Invalid party names data' }, 400);
    }
    await kv.set('party_names', JSON.stringify(partyNames));
    console.log(`✅ Saved ${partyNames.length} party names`);
    return c.json({ success: true, count: partyNames.length });
  } catch (error) {
    return c.json({ error: 'Failed to save party names', details: error.message }, 500);
  }
});

// Catch-all
app.all('*', (c) => {
  console.log(`⚠️ Unmatched route: ${c.req.method} ${c.req.url}`);
  return c.json({ error: 'Route not found', method: c.req.method, url: c.req.url }, 404);
});

console.log('🎯 All routes registered');
console.log('🌐 Starting Deno server...');

Deno.serve({
  onListen: () => console.log('✅ Server is now listening'),
}, async (req) => {
  const startTime = Date.now();
  const url = new URL(req.url);
  console.log(`\n🌍 [${req.method}] ${url.pathname}`);

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout after 25s')), 25000)  // FIX: must be under Supabase 30s limit
    );
    const response = await Promise.race([app.fetch(req), timeoutPromise]);
    console.log(`⏱️ [${req.method}] ${url.pathname} — ${Date.now() - startTime}ms`);
    if (response instanceof Response) return response;
    throw new Error('Invalid response object');
  } catch (error) {
    console.error(`❌ [${req.method}] ${url.pathname} failed after ${Date.now()-startTime}ms:`, error.message);
    return new Response(JSON.stringify({
      error: 'Server error',
      message: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
