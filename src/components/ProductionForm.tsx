import { useState, useEffect } from 'react';
import { Upload, X, Plus, Calculator } from 'lucide-react';
import type { ProductionEntry, User } from '../App';
import { isEntryLocked } from '../App';
import { usePartyNames } from '../hooks/usePartyNames';

interface ProductionFormProps {
  onSubmit: (entry: Omit<ProductionEntry, 'id' | 'createdBy' | 'approved'>) => void;
  currentUser: User;
}

export function ProductionForm({ onSubmit, currentUser }: ProductionFormProps) {
  const { partyNames, isLoading: partyNamesLoading } = usePartyNames();

  // Helper function to generate team name for multi-table users
  const getTeamName = () => {
    if (currentUser.tableNumber) {
      return `Table ${currentUser.tableNumber}`;
    }
    if (currentUser.tableNumbers && currentUser.tableNumbers.length > 0) {
      return currentUser.tableNumbers.map(num => `Table ${num}`).join('+ ');
    }
    return '';
  };

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    team: getTeamName(),
    shift: 'DAY' as 'DAY' | 'NIGHT' | 'HALF NIGHT',
    partyName: '',
    designNo: '',
    thanNo: '',
    qtyMeters: '',
    total: '',
    chemical: '',
  });

  const [qtyCalculation, setQtyCalculation] = useState('');
  const [chemicalCalculation, setChemicalCalculation] = useState('');
  const [qtyTotal, setQtyTotal] = useState(0);
  const [chemicalTotal, setChemicalTotal] = useState(0);

  const [pictures, setPictures] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>(['']);

  // Calculate quantity total
  useEffect(() => {
    if (qtyCalculation.trim()) {
      try {
        // Remove any non-numeric characters except +, -, *, /, ., and spaces
        const sanitized = qtyCalculation.replace(/[^0-9+\-*/.() ]/g, '');
        const result = eval(sanitized);
        if (!isNaN(result)) {
          setQtyTotal(parseFloat(result.toFixed(2)));
          setFormData(prev => ({ ...prev, total: result.toFixed(2) }));
        }
      } catch (error) {
        // Invalid expression, don't update
      }
    } else {
      setQtyTotal(0);
      setFormData(prev => ({ ...prev, total: '' }));
    }
  }, [qtyCalculation]);

  // Calculate chemical total with kgs format
  useEffect(() => {
    if (chemicalCalculation.trim()) {
      try {
        // Remove any non-numeric characters except +, -, *, /, ., and spaces
        const sanitized = chemicalCalculation.replace(/[^0-9+\-*/.() ]/g, '');
        const result = eval(sanitized);
        if (!isNaN(result)) {
          setChemicalTotal(parseFloat(result.toFixed(3)));
          // Format as X:YYYkgs (e.g., 1:050kgs)
          const formatted = `${Math.floor(result)}:${String(Math.round((result % 1) * 1000)).padStart(3, '0')}kgs`;
          setFormData(prev => ({ ...prev, chemical: formatted }));
        }
      } catch (error) {
        // Invalid expression, don't update
      }
    } else {
      setChemicalTotal(0);
      setFormData(prev => ({ ...prev, chemical: '' }));
    }
  }, [chemicalCalculation]);

  // Compress images to max 100KB before storing
  // A phone photo is 3-5MB — this reduces it to under 100KB
  const compressImage = (file: File, maxKB = 100): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');

          // Scale down: max 800px wide or tall (thumbnail size)
          const MAX_DIM = 600; // Smaller dimension = smaller file size for 100KB target
          let { width, height } = img;
          if (width > height && width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, width, height);

          // Try quality levels until we're under maxKB
          let quality = 0.6; // Start lower to reach 100KB target faster
          let compressed = canvas.toDataURL('image/jpeg', quality);
          while (compressed.length > maxKB * 1024 * 1.37 && quality > 0.1) {
            quality -= 0.1;
            compressed = canvas.toDataURL('image/jpeg', quality);
          }

          const sizeKB = Math.round((compressed.length * 0.75) / 1024);
          console.log(`📸 Image: ${Math.round(file.size/1024)}KB → ${sizeKB}KB (target: 100KB, quality: ${quality.toFixed(1)})`);
          resolve(compressed);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    // Limit to 5 pictures max
    if (pictures.length + fileArray.length > 5) {
      alert('Maximum 5 pictures allowed per entry.');
      return;
    }

    for (const file of fileArray) {
      // Check original file size — warn if huge
      const originalKB = Math.round(file.size / 1024);
      console.log(`📷 Processing image: ${file.name} (${originalKB}KB)`);

      const compressed = await compressImage(file, 100);
      const compressedKB = Math.round((compressed.length * 0.75) / 1024);
      console.log(`✅ Final size: ${compressedKB}KB`);
      setPictures(prev => [...prev, compressed]);
    }
  };

  const removeImage = (index: number) => {
    setPictures(prev => prev.filter((_, i) => i !== index));
  };

  const handleColorChange = (index: number, value: string) => {
    const newColors = [...colors];
    newColors[index] = value;
    setColors(newColors);
  };

  const addColorField = () => {
    setColors([...colors, '']);
  };

  const removeColor = (index: number) => {
    setColors(colors.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Check if date is locked (more than 15 days old) for non-admin
    if (isEntryLocked(formData.date, currentUser.role)) {
      alert('🔒 This date is locked. Entries older than 15 days cannot be submitted. Only Admin can modify locked entries.');
      return;
    }
    
    // Validation: All fields mandatory except for Admin
    const isAdmin = currentUser.role === 'admin';
    
    if (!isAdmin) {
      // Check all required fields
      if (!formData.date.trim()) {
        alert('Date is required!');
        return;
      }
      if (!formData.team.trim()) {
        alert('Table/Team is required!');
        return;
      }
      if (!formData.partyName.trim()) {
        alert('Party Name is required!');
        return;
      }
      if (!formData.designNo.trim()) {
        alert('Design No. is required!');
        return;
      }
      if (!formData.thanNo.trim()) {
        alert('Than No. is required!');
        return;
      }
      if (!formData.total.trim() || parseFloat(formData.total) <= 0) {
        alert('Total (M) is required and must be greater than 0!');
        return;
      }
      if (!formData.chemical.trim()) {
        alert('Chemical is required!');
        return;
      }
      // Check at least one color
      const validColors = colors.filter(c => c.trim() !== '');
      if (validColors.length === 0) {
        alert('At least one color is required!');
        return;
      }
    }
    
    onSubmit({
      ...formData,
      qtyMeters: parseFloat(formData.total) || 0,
      total: parseFloat(formData.total) || 0,
      referencePictures: pictures,
      colors: colors.filter(c => c.trim() !== ''),
    });

    // Reset form but KEEP the date
    const currentDate = formData.date; // Preserve the current date
    setFormData({
      date: currentDate, // Keep the same date
      team: getTeamName(),
      shift: 'DAY',
      partyName: '',
      designNo: '',
      thanNo: '',
      qtyMeters: '',
      total: '',
      chemical: '',
    });
    setQtyCalculation('');
    setChemicalCalculation('');
    setQtyTotal(0);
    setChemicalTotal(0);
    setPictures([]);
    setColors(['']);
  };

  const isAdmin = currentUser.role === 'admin';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Add Production Entry</h2>
        {!isAdmin && (
          <p className="text-sm text-red-600 font-medium mt-1">
            * All fields are mandatory
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date {!isAdmin && <span className="text-red-500">*</span>}
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            style={{ borderColor: isEntryLocked(formData.date, currentUser.role) ? '#ef4444' : undefined }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
            required={!isAdmin}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Table {!isAdmin && <span className="text-red-500">*</span>}
          </label>
          {isAdmin ? (
            <select
              value={formData.team}
              onChange={(e) => setFormData({ ...formData, team: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="">Select Table</option>
              <option value="Table 1">Table 1</option>
              <option value="Table 2">Table 2</option>
              <option value="Table 3">Table 3</option>
              <option value="Table 4">Table 4</option>
            </select>
          ) : (
            <input
              type="text"
              value={formData.team}
              onChange={(e) => setFormData({ ...formData, team: e.target.value })}
              readOnly={currentUser.role === 'table'}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 ${currentUser.role === 'table' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              required={!isAdmin}
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Shift {!isAdmin && <span className="text-red-500">*</span>}
          </label>
          <select
            value={formData.shift}
            onChange={(e) => setFormData({ ...formData, shift: e.target.value as 'DAY' | 'NIGHT' | 'HALF NIGHT' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            <option value="DAY">DAY</option>
            <option value="NIGHT">NIGHT</option>
            <option value="HALF NIGHT">HALF NIGHT</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Party Name {!isAdmin && <span className="text-red-500">*</span>}
          </label>
          <select
            value={formData.partyName}
            onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 text-base"
            style={{ fontSize: '15px', height: '44px' }}
          >
            <option value="">-- Select Party Name --</option>
            {partyNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Design No. {!isAdmin && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            value={formData.designNo}
            onChange={(e) => setFormData({ ...formData, designNo: e.target.value })}
            placeholder="e.g., PC 3006, JW-713497"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
            required={!isAdmin}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Than No. {!isAdmin && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            value={formData.thanNo}
            onChange={(e) => setFormData({ ...formData, thanNo: e.target.value })}
            placeholder="e.g., 3 PCS, 231 PCS"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
            required={!isAdmin}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="text-yellow-600" size={20} />
            <label className="text-sm font-medium text-gray-700">
              Quantity Calculator (M) {!isAdmin && <span className="text-red-500">*</span>}
            </label>
          </div>
          <input
            type="text"
            value={qtyCalculation}
            onChange={(e) => setQtyCalculation(e.target.value)}
            placeholder="e.g., 22+25+28+22"
            className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 mb-2"
            required={!isAdmin}
          />
          <div className="bg-white px-3 py-2 rounded-md border border-yellow-300">
            <p className="text-xs text-gray-600 mb-1">Total:</p>
            <p className="text-2xl font-bold text-yellow-600">{qtyTotal.toFixed(2)}</p>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Use +, -, *, / for calculations
          </p>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="text-blue-600" size={20} />
            <label className="text-sm font-medium text-gray-700">
              Chemical Calculator (Kgs) {!isAdmin && <span className="text-red-500">*</span>}
            </label>
          </div>
          <input
            type="text"
            value={chemicalCalculation}
            onChange={(e) => setChemicalCalculation(e.target.value)}
            placeholder="e.g., 2.5+1.2+0.8"
            className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            required={!isAdmin}
          />
          <div className="bg-white px-3 py-2 rounded-md border border-blue-300">
            <p className="text-xs text-gray-600 mb-1">Total:</p>
            <p className="text-2xl font-bold text-blue-600">{formData.chemical || '0:000kgs'}</p>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Format: X:YYYkgs (e.g., 1:050kgs = 1.05 kg)
          </p>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Colors Used {!isAdmin && <span className="text-red-500">*</span>}
        </label>
        <div className="space-y-2">
          {colors.map((color, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={color}
                onChange={(e) => handleColorChange(index, e.target.value)}
                placeholder={!isAdmin && index === 0 ? "Enter color name or code (Required)" : "Enter color name or code"}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              {colors.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeColor(index)}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addColorField}
            className="flex items-center gap-2 px-4 py-2 text-yellow-600 hover:bg-yellow-50 rounded-md"
          >
            <Plus size={18} />
            Add Color
          </button>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Reference Pictures
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-yellow-500 transition-colors">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
            id="image-upload"
          />
          <label htmlFor="image-upload" className="cursor-pointer">
            <Upload className="mx-auto mb-2 text-gray-400" size={32} />
            <p className="text-sm text-gray-600">
              Click to upload reference pictures
            </p>
          </label>
        </div>

        {pictures.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {pictures.map((pic, index) => (
              <div key={index} className="relative group">
                <img
                  src={pic}
                  alt={`Reference ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="submit"
        className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium py-3 px-4 rounded-md transition-colors"
      >
        Submit for Approval
      </button>
    </form>
  );
}
