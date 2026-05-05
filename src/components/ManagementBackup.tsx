import { useState, useRef } from 'react';
import { Download, Upload, Database, CheckCircle, AlertCircle } from 'lucide-react';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { API_URL, getAuthHeaders } from '../utils/supabase/info';

interface ManagementBackupProps {
  currentUser: any;
  apiUrl?: string;
  authHeaders?: any;
}

export function ManagementBackup({ currentUser }: ManagementBackupProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; msg: string }>({ type: null, msg: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setStatus({ type: null, msg: '' });
    try {
      // Fetch all production entries
      const allProd: any[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const res = await fetchWithTimeout(`${API_URL}/production-entries?limit=200&offset=${offset}`, {
          headers: getAuthHeaders(), timeout: 30000, retries: 1,
        });
        const data = await res.json();
        const entries = data.entries || data || [];
        allProd.push(...entries);
        hasMore = data.hasMore || false;
        offset += 200;
        if (!data.hasMore) break;
      }

      // Fetch electricity entries
      const elecRes = await fetchWithTimeout(`${API_URL}/electricity-entries`, {
        headers: getAuthHeaders(), timeout: 30000, retries: 1,
      });
      const elecData = await elecRes.json();
      const allElec = Array.isArray(elecData) ? elecData : (elecData.entries || []);

      // Create backup object
      const backup = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        productionEntries: allProd,
        electricityEntries: allElec,
        metadata: {
          totalProductionRecords: allProd.length,
          totalElectricityRecords: allElec.length,
          exportedBy: currentUser.username,
        }
      };

      // Download
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pctracker_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus({ type: 'success', msg: `✅ Downloaded backup: ${allProd.length} production + ${allElec.length} electricity records` });
    } catch (err: any) {
      setStatus({ type: 'error', msg: `❌ Export failed: ${err.message}` });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
      `⚠️ Import Backup\n\nThis will ADD all records from the backup file to your current database.\n\nExisting data will NOT be deleted.\n\nFile: ${file.name}\n\nContinue?`
    );
    if (!confirmed) return;

    setIsImporting(true);
    setStatus({ type: null, msg: '' });

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      const prodEntries = backup.productionEntries || backup.entries || [];
      const elecEntries = backup.electricityEntries || [];

      let prodUploaded = 0;
      let elecUploaded = 0;

      // Upload production entries in batches
      const BATCH = 5;
      for (let i = 0; i < prodEntries.length; i += BATCH) {
        const batch = prodEntries.slice(i, i + BATCH);
        for (const entry of batch) {
          try {
            await fetchWithTimeout(`${API_URL}/production-entries`, {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify(entry),
              timeout: 15000,
              retries: 1,
            });
            prodUploaded++;
          } catch { /* skip failed */ }
        }
        setStatus({ type: null, msg: `Uploading... ${prodUploaded}/${prodEntries.length} production entries` });
        await new Promise(r => setTimeout(r, 100));
      }

      // Upload electricity entries
      for (const entry of elecEntries) {
        try {
          await fetchWithTimeout(`${API_URL}/electricity-entries`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(entry),
            timeout: 15000,
            retries: 1,
          });
          elecUploaded++;
        } catch { /* skip */ }
      }

      setStatus({
        type: 'success',
        msg: `✅ Import complete! ${prodUploaded} production + ${elecUploaded} electricity records restored.`
      });
    } catch (err: any) {
      setStatus({ type: 'error', msg: `❌ Import failed: ${err.message}` });
    } finally {
      setIsImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '8px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ background: '#fef3c7', borderRadius: '10px', padding: '10px' }}>
            <Database size={28} color="#d97706" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Backup & Restore</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Download or restore all your data</p>
          </div>
        </div>

        {/* Status */}
        {status.type && (
          <div style={{
            background: status.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${status.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            borderRadius: '10px', padding: '14px', marginBottom: '20px',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            {status.type === 'success'
              ? <CheckCircle size={20} color="#16a34a" />
              : <AlertCircle size={20} color="#dc2626" />}
            <span style={{ fontSize: '14px', color: status.type === 'success' ? '#166534' : '#dc2626' }}>
              {status.msg}
            </span>
          </div>
        )}

        {/* Export */}
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Download size={20} color="#16a34a" />
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#166534' }}>Export Backup</h4>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#166534' }}>
            Download all your production and electricity records as a JSON backup file.
          </p>
          <button
            onClick={handleExport}
            disabled={isExporting}
            style={{
              width: '100%', padding: '13px',
              background: isExporting ? '#9ca3af' : 'linear-gradient(135deg, #16a34a, #15803d)',
              color: 'white', border: 'none', borderRadius: '10px',
              fontSize: '15px', fontWeight: 700, cursor: isExporting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              fontFamily: 'inherit',
            }}
          >
            <Download size={18} />
            {isExporting ? 'Downloading...' : 'Download Backup File'}
          </button>
        </div>

        {/* Import */}
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Upload size={20} color="#1d4ed8" />
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e40af' }}>Import Backup</h4>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#1e40af' }}>
            Restore data from a backup file. Existing data will not be deleted.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            style={{ display: 'none' }}
            id="mgmt-backup-upload"
          />
          {isImporting ? (
            <div style={{ textAlign: 'center', padding: '16px', background: '#dbeafe', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontWeight: 600, color: '#1e40af' }}>{status.msg || 'Uploading...'}</p>
            </div>
          ) : (
            <label htmlFor="mgmt-backup-upload" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', padding: '13px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: 'white', border: 'none', borderRadius: '10px',
              fontSize: '15px', fontWeight: 700, cursor: 'pointer',
              boxSizing: 'border-box',
            }}>
              <Upload size={18} />
              Choose Backup File
            </label>
          )}
        </div>

        {/* Info */}
        <div style={{ marginTop: '16px', padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>
            ✅ Backup includes all production entries, electricity records and pictures<br />
            ✅ Safe to restore — existing data is not deleted, only new records are added<br />
            ✅ Use this to transfer data between databases or restore after reset
          </p>
        </div>
      </div>
    </div>
  );
}
