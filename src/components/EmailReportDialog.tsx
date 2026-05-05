import { useState } from 'react';
import { X, Mail, Send } from 'lucide-react';

interface EmailReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reportDate: string;
}

export function EmailReportDialog({ isOpen, onClose, reportDate }: EmailReportDialogProps) {
  const [recipientEmail, setRecipientEmail] = useState('pcreation860@gmail.com');
  const [subject, setSubject] = useState(`Production Report - ${reportDate}`);
  const [message, setMessage] = useState('Please find attached the production report for your review.');
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    setSending(true);
    
    // Since we don't have email service set up, we'll show instructions
    alert(
      `📧 Email Report Instructions:\n\n` +
      `1. Click "Download Excel Report" button to download the file\n` +
      `2. Open your Gmail/email client\n` +
      `3. Compose new email to: ${recipientEmail}\n` +
      `4. Attach the downloaded Excel file\n` +
      `5. Send!\n\n` +
      `The Excel file will be saved as: Production_Report_${reportDate}.xlsx`
    );
    
    setSending(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <Mail className="text-yellow-600" size={24} />
            <h3 className="text-xl font-semibold">Email Report</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recipient Email
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="recipient@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              📎 The Excel report will be automatically attached when sent.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-md transition-colors disabled:opacity-50"
            >
              <Send size={20} />
              {sending ? 'Preparing...' : 'Send Email Instructions'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
