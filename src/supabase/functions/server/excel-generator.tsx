import ExcelJS from "npm:exceljs@4.4.0";

// Helper function to parse chemical format "X:YYYkgs" and extract numeric value in kgs
// Format: "2:450kgs" means 2.450 kgs (X:YYY where YYY is 3-digit decimal part)
const parseChemical = (chemStr: string): number => {
  if (!chemStr) return 0;
  const parts = chemStr.split(':');
  if (parts.length === 2) {
    const whole = parseInt(parts[0]) || 0;
    const decimalPart = parts[1].replace('kgs', '').padStart(3, '0');
    // Combine: "2" + "." + "450" = "2.450"
    const combined = `${whole}.${decimalPart}`;
    return parseFloat(combined);
  }
  return 0;
};

export async function generateExcelWithImages(data: any): Promise<Uint8Array> {
  const { date, startDate, endDate, useDateRange, productionEntries, electricityEntry, tableTotals } = data;

  console.log('Generating Excel report with images for date:', date);

  // Create a new workbook with ExcelJS
  const workbook = new ExcelJS.Workbook();

  // Sheet 1: Production Entries with Embedded Pictures
  const productionSheet = workbook.addWorksheet('Production Entries');
  
  // Add title rows
  productionSheet.mergeCells('A1:L1');
  productionSheet.getCell('A1').value = 'PRODUCTION ENTRIES REPORT';
  productionSheet.getCell('A1').font = { bold: true, size: 14 };
  productionSheet.getCell('A1').alignment = { horizontal: 'center' };
  
  productionSheet.mergeCells('A2:L2');
  productionSheet.getCell('A2').value = `Date: ${date}    |    Total Entries: ${productionEntries.length}`;
  productionSheet.getCell('A2').font = { size: 11 };
  productionSheet.getCell('A2').alignment = { horizontal: 'center' };
  
  // Set column headers
  productionSheet.getRow(3).values = [
    'Date', 'Table', 'Shift', 'Party Name', 'Design No.', 'Than No.', 
    'Qty (Meters)', 'Total (M)', 'Chemical', 'Colors', 'Pictures', 'Status'
  ];
  productionSheet.getRow(3).font = { bold: true };
  
  // Set column widths
  productionSheet.columns = [
    { width: 12 },  // Date
    { width: 35 },  // Table
    { width: 10 },  // Shift
    { width: 20 },  // Party Name
    { width: 15 },  // Design No
    { width: 12 },  // Than No
    { width: 14 },  // Qty
    { width: 12 },  // Total
    { width: 18 },  // Chemical
    { width: 30 },  // Colors
    { width: 20 },  // Pictures
    { width: 12 },  // Status
  ];
  
  // Add data rows with embedded images
  let currentRow = 4;
  for (const entry of productionEntries) {
    const row = productionSheet.getRow(currentRow);
    row.height = 80; // Set row height for images
    
    row.values = [
      entry.date,
      entry.team,
      entry.shift,
      entry.partyName,
      entry.designNo,
      entry.thanNo,
      entry.qtyMeters,
      entry.total,
      entry.chemical,
      entry.colors.join(', '),
      entry.referencePictures && entry.referencePictures.length > 0 
        ? `${entry.referencePictures.length} images` 
        : 'No pictures',
      entry.approved ? 'Approved' : 'Pending',
    ];
    
    // Embed images if available
    if (entry.referencePictures && entry.referencePictures.length > 0) {
      for (let i = 0; i < Math.min(entry.referencePictures.length, 3); i++) {
        const picUrl = entry.referencePictures[i];
        if (picUrl && picUrl.startsWith('data:image')) {
          try {
            // Extract base64 data
            const base64Data = picUrl.split(',')[1];
            const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            
            // Determine image extension
            const mimeMatch = picUrl.match(/data:image\/(png|jpeg|jpg|gif)/);
            const extension = mimeMatch ? mimeMatch[1] : 'png';
            
            // Add image to workbook
            const imageId = workbook.addImage({
              buffer: imageBuffer,
              extension: extension === 'jpg' ? 'jpeg' : extension,
            });
            
            // Insert image into cell K (Pictures column)
            productionSheet.addImage(imageId, {
              tl: { col: 10 + (i * 0.33), row: currentRow - 1 + (i * 0.05) },
              ext: { width: 60, height: 60 },
            });
          } catch (imgError) {
            console.error(`Error embedding image for entry ${entry.id}:`, imgError);
          }
        }
      }
    }
    
    currentRow++;
  }
  
  // Calculate and add grand totals for date range
  if (useDateRange && productionEntries.length > 0) {
    const totalQty = productionEntries.reduce((sum: number, e: any) => sum + (e.qtyMeters || 0), 0);
    const totalMeters = productionEntries.reduce((sum: number, e: any) => sum + (e.total || 0), 0);
    const totalChemicalKgs = productionEntries.reduce((sum: number, e: any) => {
      return sum + parseChemical(e.chemical || '');
    }, 0);

    const grandTotalRow = productionSheet.getRow(currentRow);
    grandTotalRow.values = [
      '', 'GRAND TOTALS', '', '', '', '',
      totalQty, totalMeters, `Total: ${totalChemicalKgs.toFixed(2)}kgs`,
      '', '', ''
    ];
    grandTotalRow.font = { bold: true, size: 12 };
    grandTotalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFEB3B' }
    };
  }

  // Sheet 2: Production Pictures Gallery (if any entries have pictures)
  const entriesWithPictures = productionEntries.filter((e: any) => e.referencePictures && e.referencePictures.length > 0);
  
  if (entriesWithPictures.length > 0) {
    const picturesSheet = workbook.addWorksheet('Production Pictures');
    
    // Add title
    picturesSheet.mergeCells('A1:E1');
    picturesSheet.getCell('A1').value = 'PRODUCTION REFERENCE PICTURES GALLERY';
    picturesSheet.getCell('A1').font = { bold: true, size: 14 };
    picturesSheet.getCell('A1').alignment = { horizontal: 'center' };
    
    picturesSheet.mergeCells('A2:E2');
    const totalPics = entriesWithPictures.reduce((sum, e) => sum + e.referencePictures.length, 0);
    picturesSheet.getCell('A2').value = `Date: ${date}    |    Total Images: ${totalPics}`;
    picturesSheet.getCell('A2').font = { size: 11 };
    picturesSheet.getCell('A2').alignment = { horizontal: 'center' };
    
    // Set headers
    picturesSheet.getRow(3).values = ['Party Name', 'Design No.', 'Than No.', 'Table', 'Picture'];
    picturesSheet.getRow(3).font = { bold: true };
    
    // Set column widths
    picturesSheet.columns = [
      { width: 20 }, // Party Name
      { width: 15 }, // Design No
      { width: 12 }, // Than No
      { width: 15 }, // Table
      { width: 25 }, // Picture
    ];
    
    let pictureRow = 4;
    entriesWithPictures.forEach((entry: any) => {
      entry.referencePictures.forEach((picUrl: string, index: number) => {
        const row = picturesSheet.getRow(pictureRow);
        row.height = 120; // Larger row for full images
        
        row.values = [
          entry.partyName,
          entry.designNo,
          entry.thanNo,
          entry.team,
          `Image ${index + 1}`
        ];
        
        // Embed full-size image
        if (picUrl && picUrl.startsWith('data:image')) {
          try {
            const base64Data = picUrl.split(',')[1];
            const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            
            const mimeMatch = picUrl.match(/data:image\/(png|jpeg|jpg|gif)/);
            const extension = mimeMatch ? mimeMatch[1] : 'png';
            
            const imageId = workbook.addImage({
              buffer: imageBuffer,
              extension: extension === 'jpg' ? 'jpeg' : extension,
            });
            
            // Insert larger image in Picture column
            picturesSheet.addImage(imageId, {
              tl: { col: 4, row: pictureRow - 1 },
              ext: { width: 150, height: 110 },
            });
          } catch (imgError) {
            console.error(`Error embedding picture:`, imgError);
          }
        }
        
        pictureRow++;
      });
    });
  }

  // Sheet 3: Table-wise Totals with Chemical Data
  const totalsSheet = workbook.addWorksheet('Table Totals');
  
  // Calculate grand totals
  const grandTotal = Object.values(tableTotals).reduce((sum: number, val: any) => sum + val, 0);
  const grandChemicalTotal = productionEntries.reduce((sum: number, e: any) => {
    return sum + parseChemical(e.chemical || '');
  }, 0);
  
  // Add title
  totalsSheet.mergeCells('A1:C1');
  totalsSheet.getCell('A1').value = 'TABLE-WISE PRODUCTION SUMMARY';
  totalsSheet.getCell('A1').font = { bold: true, size: 14 };
  totalsSheet.getCell('A1').alignment = { horizontal: 'center' };
  
  totalsSheet.mergeCells('A2:C2');
  totalsSheet.getCell('A2').value = `Date: ${date}    |    Grand Total: ${grandTotal.toFixed(1)} Meters    |    Total Chemical: ${grandChemicalTotal.toFixed(2)} kgs`;
  totalsSheet.getCell('A2').font = { size: 11 };
  totalsSheet.getCell('A2').alignment = { horizontal: 'center' };
  
  // Set headers
  totalsSheet.getRow(3).values = ['Table', 'Total Production (M)', 'Chemical Total (kgs)'];
  totalsSheet.getRow(3).font = { bold: true };
  
  // Set column widths
  totalsSheet.columns = [
    { width: 30 },
    { width: 25 },
    { width: 20 },
  ];
  
  // Add data
  let totalsRow = 4;
  Object.entries(tableTotals).forEach(([table, total]) => {
    const tableEntries = productionEntries.filter((e: any) => e.team === table);
    const chemicalTotal = tableEntries.reduce((sum: number, e: any) => {
      return sum + parseChemical(e.chemical || '');
    }, 0);
    
    totalsSheet.getRow(totalsRow).values = [table, total, chemicalTotal.toFixed(2)];
    totalsRow++;
  });
  
  // Add grand total row
  const grandRow = totalsSheet.getRow(totalsRow);
  grandRow.values = ['GRAND TOTAL', grandTotal, grandChemicalTotal.toFixed(2)];
  grandRow.font = { bold: true, size: 12 };
  grandRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4CAF50' }
  };

  // Sheet 4: Electricity Data
  if (electricityEntry) {
    const electricitySheet = workbook.addWorksheet('Electricity Data');
    
    // Add title
    electricitySheet.mergeCells('A1:F1');
    electricitySheet.getCell('A1').value = 'ELECTRICITY CONSUMPTION & COST REPORT';
    electricitySheet.getCell('A1').font = { bold: true, size: 14 };
    electricitySheet.getCell('A1').alignment = { horizontal: 'center' };
    
    electricitySheet.mergeCells('A2:F2');
    electricitySheet.getCell('A2').value = `Date: ${date}    |    Total Cost: ₹${electricityEntry.totalCost.toFixed(2)}`;
    electricitySheet.getCell('A2').font = { size: 11 };
    electricitySheet.getCell('A2').alignment = { horizontal: 'center' };
    
    // Set headers
    electricitySheet.getRow(3).values = [
      'Date', 'Previous Reading', 'Current Reading', 'Consumption (Units)', 'Unit Cost (₹)', 'Total Cost (₹)'
    ];
    electricitySheet.getRow(3).font = { bold: true };
    
    // Set column widths
    electricitySheet.columns = [
      { width: 12 },
      { width: 18 },
      { width: 18 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
    ];
    
    // Add data
    electricitySheet.getRow(4).values = [
      electricityEntry.date,
      electricityEntry.previousReading,
      electricityEntry.currentReading,
      electricityEntry.consumption,
      electricityEntry.unitCost,
      electricityEntry.totalCost,
    ];
  }

  // Generate Excel file buffer using ExcelJS
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
