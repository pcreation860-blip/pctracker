import { useState } from 'react';
import { Download, Calendar } from 'lucide-react';
import type { ProductionEntry } from '../App';

interface ReportGeneratorProps {
  entries: ProductionEntry[];
}

export function ReportGenerator({ entries }: ReportGeneratorProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTable, setSelectedTable] = useState('all');

  const filteredEntries = entries.filter(entry => {
    const entryDate = new Date(entry.date);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const dateMatch = (!start || entryDate >= start) && (!end || entryDate <= end);
    const tableMatch = selectedTable === 'all' || entry.team === selectedTable;

    return dateMatch && tableMatch;
  });

  const sortedEntries = [...filteredEntries].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const totalProduction = sortedEntries.reduce((sum, entry) => sum + entry.total, 0);
  const totalChemical = sortedEntries.reduce((sum, entry) => {
    const chemical = parseFloat(entry.chemical) || 0;
    return sum + chemical;
  }, 0);
  const totalElectricity = sortedEntries.reduce((sum, entry) => sum + (entry.factoryElectricity || 0), 0);

  // FIX: Production Cost Formula = (₹8,600 + Daily Electricity Cost) / Total Daily Production
  const FIXED_DAILY_COST = 8600; // Fixed daily overhead in ₹

  // Group entries by date for daily cost calculation
  const dailyCostData = Object.entries(
    sortedEntries.reduce((acc, entry) => {
      if (!acc[entry.date]) acc[entry.date] = { entries: [], electricityCost: 0 };
      acc[entry.date].entries.push(entry);
      acc[entry.date].electricityCost += (entry.electricityCost || 0);
      return acc;
    }, {} as Record<string, { entries: ProductionEntry[], electricityCost: number }>)
  ).map(([date, data]) => {
    const dailyProduction = data.entries.reduce((sum, e) => sum + (e.total || 0), 0);
    const dailyElecCost = data.electricityCost;
    const dailyCostPerMeter = dailyProduction > 0
      ? (FIXED_DAILY_COST + dailyElecCost) / dailyProduction
      : 0;
    return { date, dailyProduction, dailyElecCost, dailyCostPerMeter };
  });

  // Average production cost across entire date range
  const validDays = dailyCostData.filter(d => d.dailyProduction > 0);
  const averageProductionCost = validDays.length > 0
    ? validDays.reduce((sum, d) => sum + d.dailyCostPerMeter, 0) / validDays.length
    : 0;

  const totalElectricityCost = sortedEntries.reduce((sum, e) => sum + (e.electricityCost || 0), 0);

  const allTables = Array.from(new Set(entries.map(e => e.team))).sort();
  const allColors = Array.from(new Set(sortedEntries.flatMap(e => e.colors))).sort();

  const getTableTotals = () => {
    const totals: Record<string, number> = {};
    sortedEntries.forEach(entry => {
      if (!totals[entry.team]) {
        totals[entry.team] = 0;
      }
      totals[entry.team] += entry.total;
    });
    return totals;
  };

  const tableTotals = getTableTotals();

  const groupedByDate = sortedEntries.reduce((acc, entry) => {
    if (!acc[entry.date]) {
      acc[entry.date] = [];
    }
    acc[entry.date].push(entry);
    return acc;
  }, {} as Record<string, ProductionEntry[]>);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div className="bg-white rounded-lg shadow-md p-6 mb-6 print:hidden">
        <h2 className="text-xl font-semibold mb-4">Generate Production Report</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Table Filter
            </label>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="all">All Tables</option>
              {allTables.map(table => (
                <option key={table} value={table}>{table}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handlePrint}
              className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium py-2 px-4 rounded-md transition-colors"
            >
              <Download size={18} />
              Download/Print Report
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">Production Report</h1>
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <Calendar size={18} />
            <span>
              {startDate && endDate
                ? `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`
                : 'All Time'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-yellow-50 rounded-lg">
          <div className="text-center p-3 bg-white rounded-lg border border-yellow-200">
            <p className="text-xs text-gray-500 mb-1">Total Production</p>
            <p className="text-xl font-bold text-yellow-600">{totalProduction.toFixed(1)} M</p>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border border-yellow-200">
            <p className="text-xs text-gray-500 mb-1">Total Chemical</p>
            <p className="text-xl font-bold text-yellow-600">{totalChemical.toFixed(2)} kgs</p>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border border-yellow-200">
            <p className="text-xs text-gray-500 mb-1">Total Electricity</p>
            <p className="text-xl font-bold text-yellow-600">{totalElectricity} kWh</p>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border border-yellow-200">
            <p className="text-xs text-gray-500 mb-1">Electricity Cost</p>
            <p className="text-xl font-bold text-yellow-600">₹{totalElectricityCost.toFixed(0)}</p>
          </div>
        </div>

        {/* Production Cost Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-blue-50 rounded-lg">
          <div className="text-center p-4 bg-white rounded-lg border-2 border-blue-300">
            <p className="text-sm font-semibold text-blue-700 mb-1">📊 Avg Production Cost/Meter</p>
            <p className="text-3xl font-bold text-blue-600">₹{averageProductionCost.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">Avg across {validDays.length} day(s)</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-blue-200">
            <p className="text-sm font-semibold text-blue-700 mb-2">📅 Daily Breakdown</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {dailyCostData.map(d => (
                <div key={d.date} className="flex justify-between text-xs">
                  <span className="text-gray-600">{d.date}</span>
                  <span className="font-medium">{d.dailyProduction.toFixed(1)}M</span>
                  <span className="text-blue-600 font-bold">₹{d.dailyCostPerMeter.toFixed(2)}/M</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Formula: (₹8,600 + Elec Cost) ÷ Daily Production</p>
          </div>
        </div>

        {Object.keys(tableTotals).length > 0 && (
          <div className="mb-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold mb-3 text-center">Table-wise Production Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(tableTotals).map(([table, total]) => (
                <div key={table} className="bg-white p-4 rounded-lg text-center border border-blue-200">
                  <p className="text-sm text-gray-600 mb-1">{table}</p>
                  <p className="text-xl font-bold text-blue-600">{total.toFixed(1)} M</p>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center pt-4 border-t-2 border-blue-300">
              <p className="text-sm text-gray-600 mb-1">Grand Total Production</p>
              <p className="text-3xl font-bold text-green-600">{totalProduction.toFixed(1)} M</p>
            </div>
          </div>
        )}

        {allColors.length > 0 && (
          <div className="mb-8">
            <h3 className="font-semibold mb-3">Colors Used in Production</h3>
            <div className="flex flex-wrap gap-2">
              {allColors.map((color, index) => (
                <span
                  key={index}
                  className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full font-medium"
                >
                  {color}
                </span>
              ))}
            </div>
          </div>
        )}

        {Object.entries(groupedByDate).map(([date, dateEntries]) => {
          const dayTotal = dateEntries.reduce((sum, entry) => sum + entry.total, 0);
          const dayTableTotals: Record<string, number> = {};
          dateEntries.forEach(entry => {
            if (!dayTableTotals[entry.team]) {
              dayTableTotals[entry.team] = 0;
            }
            dayTableTotals[entry.team] += entry.total;
          });
          
          return (
            <div key={date} className="mb-8 break-inside-avoid">
              <div className="bg-yellow-400 px-4 py-2 rounded-t-lg">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">
                    {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </h3>
                  <span className="font-semibold">
                    Day's Total: {dayTotal.toFixed(1)} M
                  </span>
                </div>
              </div>

              <div className="border border-gray-200 rounded-b-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Table</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Shift</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Party Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Design No.</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Than No.</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">QTY (M)</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Total</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Chemical</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {dateEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-3 py-2 text-sm">{entry.team}</td>
                        <td className="px-3 py-2 text-sm">{entry.shift}</td>
                        <td className="px-3 py-2 text-sm">{entry.partyName}</td>
                        <td className="px-3 py-2 text-sm">{entry.designNo}</td>
                        <td className="px-3 py-2 text-sm">{entry.thanNo}</td>
                        <td className="px-3 py-2 text-sm">{entry.qtyMeters}</td>
                        <td className="px-3 py-2 text-sm font-medium">{entry.total}</td>
                        <td className="px-3 py-2 text-sm">{entry.chemical || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="bg-blue-50 p-3 border-t-2 border-blue-200">
                  <h4 className="text-sm font-semibold mb-2">Day's Table Totals:</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(dayTableTotals).map(([table, total]) => (
                      <div key={table} className="text-sm">
                        <span className="font-medium">{table}:</span> {total.toFixed(1)} M
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 border-t">
                  {dateEntries.map((entry) => (
                    entry.referencePictures.length > 0 && (
                      <div key={entry.id} className="break-inside-avoid">
                        <div className="mb-2">
                          <p className="text-xs font-medium text-gray-700">
                            {entry.team} - {entry.partyName} - {entry.designNo}
                          </p>
                          {entry.colors.length > 0 && (
                            <p className="text-xs text-gray-600">
                              Colors: {entry.colors.join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {entry.referencePictures.slice(0, 4).map((pic, index) => (
                            <img
                              key={index}
                              src={pic}
                              alt={`${entry.designNo} - ${index + 1}`}
                              className="w-full h-24 object-cover rounded border border-gray-200"
                            />
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {sortedEntries.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No entries found for the selected filters
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
