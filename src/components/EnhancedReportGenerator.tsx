import { useState, useEffect } from 'react';
import { Download, Calendar, FileSpreadsheet } from 'lucide-react';
import type { ProductionEntry, ElectricityEntry, User } from '../App';
import { API_URL, getAuthHeaders } from '../utils/supabase/info';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

interface EnhancedReportGeneratorProps {
  currentUser: User;
}

// API_URL imported from utils/supabase/info (Cloudflare Worker)

export function EnhancedReportGenerator({ currentUser }: EnhancedReportGeneratorProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [productionEntries, setProductionEntries] = useState<ProductionEntry[]>([]);
  const [electricityEntries, setElectricityEntries] = useState<ElectricityEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch production entries
      // FIX: Pagination loop — fetches ALL approved entries, not just first 200
      const allProdEntries: ProductionEntry[] = [];
      let prodOffset = 0;
      let prodHasMore = true;
      while (prodHasMore) {
        const prodResponse = await fetchWithTimeout(
          `${API_URL}/production-entries?limit=200&offset=${prodOffset}`,
          { headers: {  }, timeout: 35000, retries: 0 }
        );
        if (!prodResponse.ok) break;
        const prodData = await prodResponse.json();
        if (prodData.entries && Array.isArray(prodData.entries)) {
          allProdEntries.push(...prodData.entries);
          prodHasMore = prodData.hasMore === true;
        } else if (Array.isArray(prodData)) {
          allProdEntries.push(...prodData);
          prodHasMore = false;
        } else { prodHasMore = false; }
        prodOffset += 200;
        if (prodOffset > 10000) break; // safety valve
      }
      setProductionEntries(allProdEntries.filter((e: ProductionEntry) => e.approved));

      // Fetch electricity entries
      // FIX: was raw fetch() with no timeout
      const elecResponse = await fetchWithTimeout(`${API_URL}/electricity-entries`, {
        headers: {  },
        timeout: 35000,
        retries: 0,
      });
      
      if (elecResponse.ok) {
        const elecData = await elecResponse.json();
        setElectricityEntries(elecData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      
      // Fallback to localStorage
      const storedProd = localStorage.getItem('productionEntries');
      const storedElec = localStorage.getItem('electricityEntries');
      
      if (storedProd) {
        const parsed = JSON.parse(storedProd);
        setProductionEntries(parsed.filter((e: ProductionEntry) => e.approved));
      }
      if (storedElec) {
        setElectricityEntries(JSON.parse(storedElec));
      }
    }
  };

  const generateExcelReport = async () => {
    if (!startDate || !endDate) {
      alert('⚠️ Please select both start and end dates');
      return;
    }

    setIsGenerating(true);

    try {
      // Filter entries by date range
      const filteredProduction = productionEntries.filter(entry => {
        const entryDate = entry.date;
        return entryDate >= startDate && entryDate <= endDate;
      });

      const filteredElectricity = electricityEntries.filter(entry => {
        const entryDate = entry.date;
        return entryDate >= startDate && entryDate <= endDate;
      });

      // Sort by date
      const sortedProduction = [...filteredProduction].sort((a, b) => 
        a.date.localeCompare(b.date)
      );

      const sortedElectricity = [...filteredElectricity].sort((a, b) => 
        a.date.localeCompare(b.date)
      );

      // Group by date
      const groupedByDate: Record<string, ProductionEntry[]> = {};
      sortedProduction.forEach(entry => {
        if (!groupedByDate[entry.date]) {
          groupedByDate[entry.date] = [];
        }
        groupedByDate[entry.date].push(entry);
      });

      // Group electricity by date
      const electricityByDate: Record<string, ElectricityEntry[]> = {};
      sortedElectricity.forEach(entry => {
        if (!electricityByDate[entry.date]) {
          electricityByDate[entry.date] = [];
        }
        electricityByDate[entry.date].push(entry);
      });

      // Helper to parse chemical "X:YYYkgs" format correctly
      const parseChemical = (chemStr: string): number => {
        if (!chemStr) return 0;
        const parts = chemStr.split(':');
        if (parts.length === 2) {
          const whole = parseInt(parts[0]) || 0;
          const decimalPart = parts[1].replace('kgs', '').padStart(3, '0');
          return parseFloat(`${whole}.${decimalPart}`);
        }
        return 0;
      };

      // Calculate grand totals
      const grandTotalMeters = sortedProduction.reduce((sum, e) => sum + e.qtyMeters, 0);
      const grandTotalChemical = sortedProduction.reduce((sum, e) => {
        return sum + parseChemical(e.chemical);
      }, 0);
      const grandTotalElectricityCost = sortedElectricity.reduce((sum, e) => sum + e.totalCost, 0);
      const grandTotalElectricityConsumption = sortedElectricity.reduce((sum, e) => sum + e.consumption, 0);

      // Calculate average production cost across all days in range
      // ✅ 3️⃣ AVERAGE PRODUCTION COST - Calculate from days with production > 0
      const FIXED_DAILY_COST = 8600;
      
      const daysWithProduction = Object.keys(groupedByDate).filter(date => {
        const dailyTotal = groupedByDate[date].reduce((sum, e) => sum + Number(e.qtyMeters || 0), 0);
        return dailyTotal > 0;
      });
      
      const dailyCosts = daysWithProduction.map(date => {
        const dailyTotalMeters = groupedByDate[date].reduce((sum, e) => sum + Number(e.qtyMeters || 0), 0);
        const dailyElecCost = (electricityByDate[date] || []).reduce((sum, e) => sum + Number(e.totalCost || 0), 0);
        return (FIXED_DAILY_COST + Number(dailyElecCost || 0)) / dailyTotalMeters;
      });
      
      const averageProductionCost = dailyCosts.length > 0
        ? dailyCosts.reduce((sum, cost) => sum + cost, 0) / dailyCosts.length
        : 0;

      // Prepare data for Excel
      const reportData = {
        startDate,
        endDate,
        generatedBy: currentUser.username,
        generatedAt: new Date().toISOString(),
        dailyData: Object.keys(groupedByDate).map(date => {
          // ✅ 1️⃣ DAILY TOTAL (with Number() conversion)
          const dailyTotalMeters = groupedByDate[date].reduce((sum, e) => sum + Number(e.qtyMeters || 0), 0);
          const dailyElectricityCost = (electricityByDate[date] || []).reduce((sum, e) => sum + Number(e.totalCost || 0), 0);
          const dailyElectricityConsumption = (electricityByDate[date] || []).reduce((sum, e) => sum + Number(e.consumption || 0), 0);
          
          // ✅ 2️⃣ PRODUCTION COST (Rs/M) - CORRECTED FORMULA
          const FIXED_DAILY_COST = 8600;
          const dailyProductionCost = dailyTotalMeters > 0
            ? (FIXED_DAILY_COST + Number(dailyElectricityCost || 0)) / dailyTotalMeters
            : 0;
          
          // Debug production cost calculation
          if (dailyTotalMeters > 0) {
            console.log(`🧮 Production Cost for ${date}:`, {
              dailyTotalMeters,
              dailyElectricityCost,
              calculation: `(${FIXED_DAILY_COST} + ${dailyElectricityCost}) / ${dailyTotalMeters}`,
              dailyProductionCost: dailyProductionCost.toFixed(2)
            });
          }
          
          return {
            date,
            entries: groupedByDate[date].map(entry => ({
              team: entry.team,
              shift: entry.shift,
              partyName: entry.partyName,
              designNo: entry.designNo,
              thanNo: entry.thanNo,
              qtyMeters: entry.qtyMeters,
              total: entry.total,
              chemical: entry.chemical,
              colors: entry.colors.join(', '),
              referencePictures: entry.referencePictures,
              createdBy: entry.createdBy,
            })),
            dailyTotalMeters,
            dailyTotalChemical: groupedByDate[date].reduce((sum, e) => {
              return sum + parseChemical(e.chemical);
            }, 0),
            electricityEntries: electricityByDate[date] || [],
            dailyElectricityCost,
            dailyElectricityConsumption,
            dailyProductionCost, // Cost per meter in Rs
          };
        }),
        grandTotals: {
          totalMeters: grandTotalMeters,
          totalChemical: grandTotalChemical,
          totalElectricityCost: grandTotalElectricityCost,
          totalElectricityConsumption: grandTotalElectricityConsumption,
          averageProductionCost: averageProductionCost, // Average cost per meter across date range
          numberOfDays: daysWithProduction.length,
        }
      };

      // Count total images
      const totalImages = sortedProduction.reduce((sum, entry) => {
        return sum + (entry.referencePictures?.length || 0);
      }, 0);

      // Send to server to generate Excel
      console.log('📤 Sending request to generate Excel...', {
        startDate,
        endDate,
        dailyDataCount: reportData.dailyData.length,
        productionRecords: sortedProduction.length,
        electricityRecords: sortedElectricity.length,
        totalImages: totalImages,
      });
      
      // Debug: Log production costs being sent
      console.log('🧮 Production Costs being sent to server:');
      reportData.dailyData.forEach((day, idx) => {
        console.log(`  Day ${idx + 1} (${day.date}): dailyProductionCost = ${day.dailyProductionCost}`);
      });

      if (totalImages > 0) {
        console.log(`📸 Processing ${totalImages} images - this may take a moment...`);
      }

      // Generate Excel via Cloudflare Worker (styled with colors + formatting)
      console.log('📊 Requesting Excel from Cloudflare Worker...');

      // Call Cloudflare Worker to generate styled Excel
      const excelResponse = await fetch(`${API_URL}/generate-excel`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(reportData),
      });

      if (!excelResponse.ok) {
        const errText = await excelResponse.text();
        throw new Error(`Server error: ${excelResponse.status} - ${errText}`);
      }

      const blob = await excelResponse.blob();
      const dlUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = dlUrl;
      link.download = `Production_Report_${startDate}_to_${endDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(dlUrl);

      console.log('✅ Excel downloaded!');
      alert('✅ Excel report downloaded successfully!');
      return; // Done - rest of code below is old browser generation (not used)

      // OLD BROWSER CODE (kept as fallback reference but not executed)
      const XLSX = (window as any).XLSX;
      const wb = XLSX.utils.book_new();
      const wsData: any[][] = [];

      // ===== TITLE =====
      wsData.push(['PRODUCTION TRACKING REPORT']);
      wsData.push([`Period: ${startDate} to ${endDate}  |  Generated by: ${currentUser.username}`]);
      wsData.push([]); // blank row

      // ===== DAILY DATA - matches old format exactly =====
      // reportData.dailyData is array of { date, entries[], dailyTotalMeters, electricityEntries[], dailyElectricityCost, dailyProductionCost }
      const sortedDays = [...(reportData.dailyData || [])].sort((a, b) => a.date.localeCompare(b.date));

      sortedDays.forEach(day => {
        // DATE header row
        wsData.push([`DATE: ${day.date}`]);

        // Column headers
        wsData.push(['Date', 'Table', 'Shift', 'Party Name', 'Design No.', 'Than No.', 'Qty (M)', 'Chemical (kgs)', 'Colors', 'Created By', 'Supporting Pictures']);

        // Entry rows
        let dayTotal = 0;
        let dayChemTotal = 0;
        (day.entries || []).forEach((entry: any) => {
          const qty = Number(entry.qtyMeters || entry.total || 0);
          dayTotal += qty;
          wsData.push([
            day.date,
            entry.team || '',
            entry.shift || 'DAY',
            entry.partyName || '',
            entry.designNo || '',
            entry.thanNo || '',
            qty,
            entry.chemical || '0',
            Array.isArray(entry.colors) ? entry.colors.join(', ') : (entry.colors || ''),
            entry.createdBy || '',
            '', // Supporting Pictures placeholder
          ]);
        });

        // Daily total row
        wsData.push(['', '', '', '', '', 'Daily Total:', day.dailyTotalMeters || dayTotal, '', '', '']);

        // Production cost row
        const costStr = day.dailyProductionCost > 0
          ? `₹${Number(day.dailyProductionCost).toFixed(2)}/M`
          : '';
        wsData.push(['', '', '', '', '', 'Production Cost:', '', '', costStr, '']);

        // Electricity row (if any)
        if (day.electricityEntries && day.electricityEntries.length > 0) {
          day.electricityEntries.forEach((elec: any) => {
            wsData.push(['', 'Electricity Consumption']);
            const prev = elec.previousReading || 0;
            const curr = elec.currentReading || 0;
            const units = elec.consumption || elec.unitsConsumed || (curr - prev);
            const cost = elec.totalCost || elec.electricityCost || 0;
            wsData.push(['', `Prev: ${prev} kWh → Curr: ${curr} kWh`, '', '', '', '', `${units} kWh`, '', `₹${cost}`, '']);
            wsData.push(['', '', '', '', '', 'Daily Electricity:', `${units} kWh`, '', `₹${cost}`, '']);
          });
        }

        // 2 blank rows between days (matches old format)
        wsData.push([]);
        wsData.push([]);
      });

      // ===== GRAND TOTALS =====
      wsData.push(['GRAND TOTALS (ENTIRE PERIOD)']);
      wsData.push(['', '', '', 'Total Meters:', '', '', reportData.grandTotals?.totalMeters?.toFixed(2) || '0']);
      wsData.push(['', '', '', 'Total Chemical:', '', '', reportData.grandTotals?.totalChemical?.toFixed(3) || '0']);
      wsData.push(['', '', '', 'Total Electricity Consumption:', '', '', reportData.grandTotals?.totalElectricityConsumption || '0']);
      wsData.push(['', '', '', 'Total Electricity Cost:', '', '', `₹${reportData.grandTotals?.totalElectricityCost || 0}`]);
      wsData.push(['', '', '', 'Average Production Cost:', '', '', `₹${(reportData.grandTotals?.averageProductionCost || 0).toFixed(2)}/M`]);
      wsData.push([]);
      wsData.push([`Report generated on ${new Date().toLocaleString()} by ${currentUser.username}`]);

      // ===== CREATE WORKSHEET =====
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Set column widths to match old report
      ws['!cols'] = [
        { wch: 12 }, // Date
        { wch: 28 }, // Table
        { wch: 12 }, // Shift
        { wch: 12 }, // Party Name
        { wch: 20 }, // Design No.
        { wch: 12 }, // Than No.
        { wch: 10 }, // Qty (M)
        { wch: 15 }, // Chemical
        { wch: 12 }, // Colors
        { wch: 14 }, // Created By
        { wch: 20 }, // Supporting Pictures
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Production Report');
      XLSX.writeFile(wb, `Production_Report_${startDate}_to_${endDate}.xlsx`);

      console.log('✅ Excel report downloaded! Days:', sortedDays.length, 'Total entries:', sortedDays.reduce((s, d) => s + d.entries.length, 0));
      alert(`✅ Excel report generated!\n${sortedDays.length} days\n${sortedDays.reduce((s, d) => s + d.entries.length, 0)} entries`);
    } catch (error) {
      console.error('❌ Error generating Excel report:', error);
      alert(`❌ Failed to generate Excel report:\n${error.message}\n\nCheck browser console for details.`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Calculate preview statistics
  const filteredProduction = productionEntries.filter(entry => {
    if (!startDate || !endDate) return false;
    return entry.date >= startDate && entry.date <= endDate;
  });

  const filteredElectricity = electricityEntries.filter(entry => {
    if (!startDate || !endDate) return false;
    return entry.date >= startDate && entry.date <= endDate;
  });

  // Helper to parse chemical "X:YYYkgs" format correctly
  const parseChemicalHelper = (chemStr: string): number => {
    if (!chemStr) return 0;
    const parts = chemStr.split(':');
    if (parts.length === 2) {
      const whole = parseInt(parts[0]) || 0;
      const decimalPart = parts[1].replace('kgs', '').padStart(3, '0');
      return parseFloat(`${whole}.${decimalPart}`);
    }
    return 0;
  };

  // Calculate average production cost for preview
  const groupedByDatePreview: Record<string, ProductionEntry[]> = {};
  filteredProduction.forEach(entry => {
    if (!groupedByDatePreview[entry.date]) {
      groupedByDatePreview[entry.date] = [];
    }
    groupedByDatePreview[entry.date].push(entry);
  });

  const electricityByDatePreview: Record<string, ElectricityEntry[]> = {};
  filteredElectricity.forEach(entry => {
    if (!electricityByDatePreview[entry.date]) {
      electricityByDatePreview[entry.date] = [];
    }
    electricityByDatePreview[entry.date].push(entry);
  });

  const daysWithProductionPreview = Object.keys(groupedByDatePreview).filter(date => {
    const dailyTotal = groupedByDatePreview[date].reduce((sum, e) => sum + Number(e.qtyMeters || 0), 0);
    return dailyTotal > 0;
  });

  const FIXED_DAILY_COST = 8600;
  const dailyCostsPreview = daysWithProductionPreview.map(date => {
    const dailyTotalMeters = groupedByDatePreview[date].reduce((sum, e) => sum + Number(e.qtyMeters || 0), 0);
    const dailyElecCost = (electricityByDatePreview[date] || []).reduce((sum, e) => sum + Number(e.totalCost || 0), 0);
    return (FIXED_DAILY_COST + Number(dailyElecCost || 0)) / dailyTotalMeters;
  });

  const averageCostPreview = dailyCostsPreview.length > 0
    ? dailyCostsPreview.reduce((sum, cost) => sum + cost, 0) / dailyCostsPreview.length
    : 0;

  const previewStats = {
    totalRecords: filteredProduction.length,
    totalMeters: filteredProduction.reduce((sum, e) => sum + e.qtyMeters, 0),
    totalChemical: filteredProduction.reduce((sum, e) => {
      return sum + parseChemicalHelper(e.chemical);
    }, 0),
    totalElectricityCost: filteredElectricity.reduce((sum, e) => sum + e.totalCost, 0),
    totalElectricityConsumption: filteredElectricity.reduce((sum, e) => sum + e.consumption, 0),
    electricityRecords: filteredElectricity.length,
    averageProductionCost: averageCostPreview,
    numberOfDays: daysWithProductionPreview.length,
  };

  // Debug logging for production costing
  if (startDate && endDate) {
    console.log('📊 Production Costing Debug:', {
      dateRange: `${startDate} to ${endDate}`,
      totalProductionRecords: filteredProduction.length,
      totalMeters: previewStats.totalMeters,
      electricityRecords: filteredElectricity.length,
      totalElectricityCost: previewStats.totalElectricityCost,
      daysWithProduction: daysWithProductionPreview.length,
      dailyCosts: dailyCostsPreview,
      averageCost: averageCostPreview,
    });
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-3 mb-6">
        <FileSpreadsheet className="text-green-600" size={32} />
        <div>
          <h2 className="text-2xl font-bold">Excel Report Generator</h2>
          <p className="text-sm text-gray-600">Generate comprehensive production reports with electricity data</p>
        </div>
      </div>

      {/* Date Range Selection */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Calendar size={20} className="text-blue-600" />
          Select Date Range
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Preview Statistics */}
      {startDate && endDate && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold mb-4 text-green-800">Report Preview</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-600">Production Records</p>
              <p className="text-2xl font-bold text-blue-600">{previewStats.totalRecords}</p>
            </div>
            
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-600">Total Meters</p>
              <p className="text-2xl font-bold text-green-600">{previewStats.totalMeters.toFixed(2)}</p>
            </div>
            
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-600">Total Chemical (kgs)</p>
              <p className="text-2xl font-bold text-purple-600">{previewStats.totalChemical.toFixed(2)}</p>
            </div>
            
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-600">Electricity Records</p>
              <p className="text-2xl font-bold text-yellow-600">{previewStats.electricityRecords}</p>
            </div>
            
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-600">Electricity Consumption</p>
              <p className="text-2xl font-bold text-orange-600">{previewStats.totalElectricityConsumption.toFixed(2)} kWh</p>
            </div>
            
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-600">Electricity Cost</p>
              <p className="text-2xl font-bold text-red-600">₹{previewStats.totalElectricityCost.toFixed(2)}</p>
            </div>
            
            <div className="bg-gradient-to-br from-yellow-100 to-orange-100 rounded-lg p-3 shadow-md border-2 border-orange-300 col-span-2 md:col-span-3">
              {previewStats.averageProductionCost > 0 ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-700 font-semibold">📊 Average Production Cost Per Meter</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Formula: (₹8,600 + Daily Electricity) / Total Daily Production
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Calculated across {previewStats.numberOfDays} day{previewStats.numberOfDays !== 1 ? 's' : ''} with production
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-bold text-orange-600">₹{Math.round(previewStats.averageProductionCost)}</p>
                    <p className="text-xs text-gray-600 mt-1">(₹{previewStats.averageProductionCost.toFixed(2)} exact)</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-lg font-semibold text-orange-700">📊 Average Production Cost Per Meter</p>
                  <p className="text-sm text-gray-600 mt-2">
                    Formula: (₹8,600 + Daily Electricity) / Total Daily Production
                  </p>
                  <div className="mt-4 bg-white rounded-lg p-4 border border-orange-200">
                    <p className="text-gray-700 font-medium">⚠️ No Data Available for Calculation</p>
                    <div className="mt-3 text-sm text-gray-600 space-y-1 text-left">
                      <p>• Production Records: <span className="font-semibold">{previewStats.totalRecords}</span></p>
                      <p>• Total Production: <span className="font-semibold">{previewStats.totalMeters.toFixed(2)} meters</span></p>
                      <p>• Electricity Records: <span className="font-semibold">{previewStats.electricityRecords}</span></p>
                      <p>• Total Electricity Cost: <span className="font-semibold">₹{previewStats.totalElectricityCost.toFixed(2)}</span></p>
                    </div>
                    <div className="mt-3 text-xs text-left">
                      {previewStats.totalRecords === 0 && (
                        <p className="text-red-600 font-semibold">❌ No approved production records in this date range</p>
                      )}
                      {previewStats.totalMeters === 0 && previewStats.totalRecords > 0 && (
                        <p className="text-red-600 font-semibold">❌ Production records exist but total meters is 0</p>
                      )}
                      {previewStats.totalMeters > 0 && (
                        <p className="text-green-600 font-semibold">✅ Production data exists - calculation should work!</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <div className="flex gap-4">
        <button
          onClick={generateExcelReport}
          disabled={!startDate || !endDate || isGenerating}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          <Download size={20} />
          {isGenerating ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Generating Excel with Pictures...
            </div>
          ) : 'Download Excel Report (with Pictures)'}
        </button>
        
        <button
          onClick={fetchData}
          className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-semibold"
        >
          Refresh Data
        </button>
      </div>

      {/* Report Information */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="font-semibold mb-2 text-sm text-gray-700">📋 Report Includes:</h4>
        <ul className="text-sm text-gray-600 space-y-1 ml-4">
          <li>• Day-to-day production hierarchy</li>
          <li>• All table data organized by date</li>
          <li>• Reference pictures (image URLs included)</li>
          <li>• Daily electricity consumption in kWh and ₹</li>
          <li>• <span className="font-semibold text-orange-600">Daily production cost per meter</span> - Formula: (₹8,600 + Daily Electricity) / Total Daily Production</li>
          <li>• <span className="font-semibold text-orange-600">Average production cost</span> across entire date range</li>
          <li>• Daily totals: Meters, Chemical (kgs), Electricity cost</li>
          <li>• Grand totals for the entire date range</li>
          <li>• Colors, shifts, party names, design numbers</li>
          <li>• Created by information for each entry</li>
        </ul>
      </div>
    </div>
  );
}
