import { Calendar, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function InvoiceTotals({
  subtotalExclTax,
  totalTax,
  grandTotal,
  isSale,
  dueDate,
  quickDue,
  handleQuickDue,
  handleCustomDate,
  setQuickDue,
  setDueDate,
  description,
  setDescription,
  onClose,
  isSaving,
  transactionData,
  t
}) {
  return (
    <>
      <div className="mt-3 flex justify-end">
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 min-w-[260px] space-y-2">
          <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400">
            <span>{t('invoice_subtotal')}</span>
            <span className="font-mono">{subtotalExclTax.toFixed(2)} ₺</span>
          </div>
          <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400">
            <span>{t('invoice_tax_total')}</span>
            <span className="font-mono text-amber-600 dark:text-amber-400">+{totalTax.toFixed(2)} ₺</span>
          </div>
          <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-900 dark:text-white text-sm">{t('invoice_grand_total')}</span>
            <span className={`font-mono font-extrabold text-lg ${isSale ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
              {grandTotal.toFixed(2)} ₺
            </span>
          </div>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3 mt-6">
          <Calendar size={12} />
          {t('form_due_date')}
        </label>

        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-xs text-slate-400 self-center font-medium">{t('form_quick_due')}:</span>
          {[7, 15, 30, 60].map(days => (
            <button
              key={days}
              type="button"
              onClick={() => handleQuickDue(days)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-200 ${quickDue === days
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
            >
              {days} {t('days')}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setQuickDue(null); setDueDate(''); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-200 ${!quickDue && !dueDate
              ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
              : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
              }`}
          >
            {t('no_due_date')}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{t('custom_date')}:</span>
          <input
            type="date"
            className="bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            value={dueDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={e => handleCustomDate(e.target.value)}
          />
          {dueDate && (
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-700">
              📅 {new Date(dueDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 mt-6 block">{t('form_description')}</label>
        <textarea
          rows="2"
          className="w-full bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none font-medium transition-all"
          placeholder="Fatura ile ilgili not veya açıklama..."
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      {/* ── Footer ── */}
      <div className="px-6 py-4 mt-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 rounded-b-3xl shrink-0 -mx-6 -mb-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            {t('btn_cancel')}
          </button>
          <button
            type="submit"
            disabled={isSaving || grandTotal <= 0}
            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${isSale
              ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
              : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
              }`}
          >
            <FileText size={16} />
            {isSaving ? 'Kaydediliyor...' : `${transactionData ? t('btn_update') : t('btn_create_invoice')} — ${grandTotal.toFixed(2)} ₺`}
          </button>
        </div>
      </div>
    </>
  );
}
