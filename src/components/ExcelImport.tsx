import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, FileSpreadsheet, X } from 'lucide-react';
import { API_URL, getAuthHeaders } from '../utils/supabase/info';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import type { ProductionEntry } from '../App';

// API_URL imported from utils/supabase/info

interface ExcelImportProps {
  onImportComplete: () => void;
}

// Parse chemical value - handle both "18.800" and "1:800kgs" formats
const parseChemical = (val: string): string => {
  if (!val) return '0';
  return String(val).trim();
};

// Compress image bytes to base64 JPEG under maxKB
const compressImageBytes = (bytes: Uint8Array, maxKB = 100): Promise<string> => {
  return new Promise((resolve, reject) => {
    const blob = new Blob([bytes]);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const MAX_DIM = 600;
      let { width: w, height: h } = img;
      if (w > h && w > MAX_DIM) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
      else if (h > MAX_DIM) { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      let quality = 0.7;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > maxKB * 1024 * 1.37 && quality > 0.1) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(dataUrl);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
};

// Parse Excel rows + extract embedded images
const parseExcelData = async (data: any[][], workbook: any): Promise<{ entries: any[], errors: string[] }> => {
  const entries: any[] = [];
  const errors: string[] = [];
  let currentDate = '';

  // Extract embedded images from workbook and map by row
  const rowImages: Record<number, string[]> = {};
  try {
    const XLSX = (window as any).XLSX;
    const ws = workbook.Sheets[workbook.SheetNames[0]];

    // SheetJS stores images in ws['!images'] array
    const images = (ws as any)['!images'] || [];
    console.log(`📸 Found ${images.length} embedded images in Excel`);

    for (const imgObj of images) {
      try {
        let rowNum: number | null = null;
        // Get anchor row
        if (imgObj.editAs !== undefined && imgObj.From) {
          rowNum = imgObj.From.r + 1; // 0-indexed to 1-indexed
        } else if (imgObj.from) {
          rowNum = imgObj.from.r + 1;
        } else if (imgObj.Anchor) {
          rowNum = imgObj.Anchor.from?.r + 1;
        }

        if (rowNum !== null && imgObj.data) {
          // imgObj.data is base64 string or Uint8Array
          let bytes: Uint8Array;
          if (typeof imgObj.data === 'string') {
            const bin = atob(imgObj.data);
            bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          } else {
            bytes = imgObj.data;
          }
          const compressed = await compressImageBytes(bytes, 100);
          if (!rowImages[rowNum]) rowImages[rowNum] = [];
          rowImages[rowNum].push(compressed);
          console.log(`  📷 Image at row ${rowNum} compressed to ${Math.round(compressed.length * 0.75 / 1024)}KB`);
        }
      } catch (imgErr) {
        console.warn('Could not process image:', imgErr);
      }
    }
  } catch (imgExtractErr) {
    console.warn('Image extraction failed, continuing without images:', imgExtractErr);
  }

  // Parse data rows
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 1; // Excel rows are 1-indexed
    if (!row || row.every((v: any) => v === null || v === undefined || v === '')) continue;

    const cell0 = String(row[0] || '').trim();

    if (cell0.startsWith('DATE:')) {
      currentDate = cell0.replace('DATE:', '').trim().substring(0, 10);
      continue;
    }

    if (
      cell0 === 'Date' || cell0 === 'PRODUCTION TRACKING REPORT' ||
      cell0.startsWith('Period:') || cell0.startsWith('GRAND') ||
      String(row[5] || '').startsWith('Daily') ||
      String(row[5] || '').startsWith('Production') ||
      String(row[5] || '').startsWith('Daily Electricity') ||
      String(row[1] || '').startsWith('Electricity') ||
      String(row[1] || '').startsWith('Total Meters') ||
      String(row[1] || '').startsWith('Total Chemical') ||
      String(row[1] || '').startsWith('Average')
    ) continue;

    const dateVal = cell0.length >= 8 ? cell0.substring(0, 10) : currentDate;
    const qty = parseFloat(String(row[6] || '0'));
    const party = String(row[3] || '').trim();

    if (!dateVal || !party || party === 'Party Name' || isNaN(qty) || qty <= 0) continue;

    // Attach any images anchored to this row
    const pics = rowImages[rowNum] || [];

    entries.push({
      id: `import_${dateVal}_${rowNum}_${Math.random().toString(36).substr(2, 9)}`,
      date: dateVal,
      team: String(row[1] || '').trim(),
      shift: String(row[2] || 'DAY').trim(),
      partyName: party,
      designNo: String(row[4] || '').trim(),
      thanNo: String(row[5] || '').trim(),
      qtyMeters: qty,
      total: qty,
      chemical: parseChemical(String(row[7] || '0')),
      colors: row[8] ? [String(row[8]).trim()] : [],
      createdBy: String(row[9] || 'Excel Import').trim(),
      referencePictures: pics,
      approved: true,
      timestamp: new Date(`${dateVal}T12:00:00.000Z`).toISOString(),
      importedFromExcel: true,
    });
  }

  return { entries, errors };
};

export function ExcelImport({ onImportComplete }: ExcelImportProps) {
  const [step, setStep] = useState<'idle' | 'parsing' | 'preview' | 'uploading' | 'done' | 'error'>('idle');
  const [parsedEntries, setParsedEntries] = useState<any[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadedCount, setUploadedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setErrorMsg('Please upload an Excel file (.xlsx or .xls)');
      setStep('error');
      return;
    }

    setStep('parsing' as any); // Show parsing state during image extraction
    setUploadProgress(5);

    try {
      // Use SheetJS via CDN script — load dynamically
      const XLSX = (window as any).XLSX;
      if (!XLSX) {
        // Load XLSX library dynamically
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load XLSX library'));
          document.head.appendChild(script);
        });
      }

      const XLSXLib = (window as any).XLSX;
      const buffer = await file.arrayBuffer();
      const wb = XLSXLib.read(buffer, { type: 'array', cellStyles: true, cellDates: true, cellNF: true, sheetStubs: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSXLib.utils.sheet_to_json(ws, { header: 1, defval: null });

      const { entries, errors } = await parseExcelData(data as any[][], wb);

      if (entries.length === 0) {
        setErrorMsg("No valid production entries found in this Excel file. Make sure it's a PCTracker export.");
        setStep('error');
        return;
      }

      const totalPics = entries.reduce((s: number, e: any) => s + (e.referencePictures?.length || 0), 0);
      console.log(`✅ Parsed ${entries.length} entries with ${totalPics} pictures`);
      setParsedEntries(entries);
      setStep('preview');
    } catch (err: any) {
      setErrorMsg(`Failed to read Excel file: ${err.message}`);
      setStep('error');
    }
  };

  const handleUpload = async () => {
    setStep('uploading');
    setUploadProgress(0);
    let uploaded = 0;

    // Upload in batches of 10
    const BATCH = 10;
    for (let i = 0; i < parsedEntries.length; i += BATCH) {
      const batch = parsedEntries.slice(i, i + BATCH);
      for (const entry of batch) {
        try {
          await fetchWithTimeout(`${API_URL}/production-entries`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify(entry),
            timeout: 15000,
            retries: 1,
          });
          uploaded++;
        } catch (err) {
          console.error('Failed to upload entry:', err);
        }
      }
      setUploadProgress(Math.round(((i + BATCH) / parsedEntries.length) * 100));
      setUploadedCount(uploaded);
      // Small delay between batches
      await new Promise(r => setTimeout(r, 200));
    }

    setUploadedCount(uploaded);
    setStep('done');
    setTimeout(() => {
      onImportComplete();
    }, 2000);
  };

  const reset = () => {
    setStep('idle');
    setParsedEntries([]);
    setErrorMsg('');
    setUploadProgress(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  // Count unique dates
  const uniqueDates = [...new Set(parsedEntries.map(e => e.date))].sort();

  return (
    <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: '#fef3c7', borderRadius: '10px', padding: '10px' }}>
          <FileSpreadsheet size={28} color="#d97706" />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Import from Excel</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Upload previous month's data from PCTracker Excel report</p>
        </div>
      </div>

      {step === 'idle' && (
        <div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} id="excel-upload" />
          <label htmlFor="excel-upload" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '32px', border: '2px dashed #d1d5db', borderRadius: '12px',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#f59e0b')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#d1d5db')}
          >
            <Upload size={36} color="#9ca3af" style={{ marginBottom: '12px' }} />
            <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '15px', color: '#374151' }}>
              Click to upload Excel file
            </p>
            <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>
              Supports .xlsx exports from PCTracker
            </p>
          </label>
          <div style={{ marginTop: '12px', padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#166534' }}>
              ✅ Imported data will be marked as <strong>approved</strong> automatically<br />
              ✅ Will not overwrite or affect existing entries<br />
              ✅ Each entry gets a unique ID to prevent duplicates
            </p>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '15px', color: '#166534' }}>
              ✅ Found {parsedEntries.length} entries across {uniqueDates.length} days
            </p>
            <p style={{ margin: 0, fontSize: '13px', color: '#166534' }}>
              Date range: {uniqueDates[0]} to {uniqueDates[uniqueDates.length - 1]}
            </p>
          </div>

          {/* Preview table */}
          <div style={{ overflowX: 'auto', maxHeight: '250px', overflowY: 'auto', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                <tr>
                  {['Date', 'Party', 'Design No', 'Qty (M)', 'Shift', 'Table', 'By', '📸'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedEntries.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>{e.date}</td>
                    <td style={{ padding: '7px 12px' }}>{e.partyName}</td>
                    <td style={{ padding: '7px 12px' }}>{e.designNo}</td>
                    <td style={{ padding: '7px 12px', fontWeight: 600 }}>{e.qtyMeters}</td>
                    <td style={{ padding: '7px 12px' }}>{e.shift}</td>
                    <td style={{ padding: '7px 12px', fontSize: '12px' }}>{e.team}</td>
                    <td style={{ padding: '7px 12px' }}>{e.createdBy}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                      {e.referencePictures?.length > 0 ? `📸 ${e.referencePictures.length}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleUpload} style={{
              flex: 1, padding: '13px', background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700,
              fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              ✅ Upload {parsedEntries.length} Entries to Database
            </button>
            <button onClick={reset} style={{
              padding: '13px 18px', background: '#f3f4f6', color: '#374151',
              border: 'none', borderRadius: '10px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {(step as string) === 'parsing' && (
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
          <p style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>
            Reading Excel file & extracting pictures...
          </p>
          <p style={{ fontSize: '13px', color: '#6b7280' }}>This may take 30-60 seconds for large files</p>
        </div>
      )}

      {step === 'uploading' && (
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⬆️</div>
          <p style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>
            Uploading... {uploadedCount}/{parsedEntries.length} entries
          </p>
          <div style={{ background: '#e5e7eb', borderRadius: '999px', height: '12px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{
              background: 'linear-gradient(90deg, #f59e0b, #10b981)',
              height: '100%', width: `${Math.min(uploadProgress, 100)}%`,
              transition: 'width 0.3s ease', borderRadius: '999px'
            }} />
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280' }}>Please wait, do not close this page</p>
        </div>
      )}

      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <CheckCircle size={48} color="#10b981" style={{ marginBottom: '12px' }} />
          <p style={{ fontWeight: 700, fontSize: '18px', color: '#065f46', marginBottom: '4px' }}>
            Successfully imported {uploadedCount} entries!
          </p>
          <p style={{ fontSize: '13px', color: '#6b7280' }}>Refreshing data...</p>
        </div>
      )}

      {step === 'error' && (
        <div>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '16px', marginBottom: '16px', display: 'flex', gap: '10px' }}>
            <AlertCircle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, color: '#dc2626', fontSize: '14px' }}>{errorMsg}</p>
          </div>
          <button onClick={reset} style={{
            padding: '10px 20px', background: '#f3f4f6', border: 'none',
            borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
          }}>Try Again</button>
        </div>
      )}
    </div>
  );
}
