import { FileText, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function InvoiceHeader({ isSale, modalTitle, entityName, onClose, t }) {
  return (
    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/30 rounded-t-3xl shrink-0">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${isSale ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-blue-50 dark:bg-blue-500/10'}`}>
          <FileText size={20} className={isSale ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'} />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">
            {modalTitle}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('invoice_for')}: <span className="font-semibold text-slate-700 dark:text-slate-300">{entityName}</span>
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <X size={20} />
      </button>
    </div>
  );
}
