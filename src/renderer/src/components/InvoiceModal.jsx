import { useState, useEffect } from 'react';
import { X, Plus, Trash2, FileText, Calendar, Package, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Helper: Calculate due date from today + N days
const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
};

// Empty line item template
const emptyLineItem = () => ({
  _key: Math.random(),
  item_id: '',
  item_name: '',
  quantity: 1,
  unit_price: 0,
  tax_rate: 0,
  subtotal: 0,
});

// Calculate subtotal for a line item
const calcSubtotal = (qty, price, tax) => {
  const base = parseFloat(qty || 0) * parseFloat(price || 0);
  return parseFloat((base * (1 + parseFloat(tax || 0) / 100)).toFixed(2));
};

export default function InvoiceModal({ entity, transactionType, onClose, onSuccess, transactionData }) {
  const { t } = useTranslation();

  const [items, setItems] = useState([]); // Stock items from DB
  const [lineItems, setLineItems] = useState([emptyLineItem()]);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [quickDue, setQuickDue] = useState(null); // 7 | 15 | 30 | 60
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load stock items and initial data if editing
  useEffect(() => {
    window.api.items.getAll().then(setItems).catch(console.error);

    if (transactionData) {
      setDescription(transactionData.description || '');
      setDueDate(transactionData.due_date ? transactionData.due_date.split('T')[0] : '');
      
      // Fetch line items for this transaction
      window.api.transactions.getItems(transactionData.id)
        .then(items => {
          setLineItems(items.map(it => ({
            ...it,
            _key: Math.random() // Unique key for UI
          })));
        })
        .catch(console.error);
    }
  }, [transactionData]);

  // --- Line Item Handlers ---

  const handleItemSelect = (index, itemId) => {
    const stockItem = items.find(i => i.id == itemId);
    setLineItems(prev => {
      const updated = [...prev];
      if (stockItem) {
        updated[index] = {
          ...updated[index],
          item_id: itemId,
          item_name: stockItem.name,
          unit_price: stockItem.unit_price,
          tax_rate: stockItem.tax_rate || 0,
          subtotal: calcSubtotal(updated[index].quantity, stockItem.unit_price, stockItem.tax_rate || 0),
        };
      } else {
        updated[index] = { ...updated[index], item_id: '', item_name: '', unit_price: 0, tax_rate: 0, subtotal: 0 };
      }
      return updated;
    });
  };

  const handleFieldChange = (index, field, value) => {
    setLineItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Recalculate subtotal whenever qty, price or tax changes
      const li = updated[index];
      updated[index].subtotal = calcSubtotal(
        field === 'quantity' ? value : li.quantity,
        field === 'unit_price' ? value : li.unit_price,
        field === 'tax_rate' ? value : li.tax_rate,
      );
      return updated;
    });
  };

  const handleAddRow = () => setLineItems(prev => [...prev, emptyLineItem()]);

  const handleRemoveRow = (index) => {
    if (lineItems.length === 1) return; // Keep at least one row
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  // --- Due Date Handlers ---

  const handleQuickDue = (days) => {
    setQuickDue(days);
    setDueDate(addDays(days));
  };

  const handleCustomDate = (val) => {
    setQuickDue(null);
    setDueDate(val);
  };

  // --- Totals ---

  const subtotalExclTax = lineItems.reduce((sum, li) => {
    return sum + parseFloat(li.quantity || 0) * parseFloat(li.unit_price || 0);
  }, 0);

  const totalTax = lineItems.reduce((sum, li) => {
    const base = parseFloat(li.quantity || 0) * parseFloat(li.unit_price || 0);
    return sum + base * (parseFloat(li.tax_rate || 0) / 100);
  }, 0);

  const grandTotal = lineItems.reduce((sum, li) => sum + parseFloat(li.subtotal || 0), 0);

  // --- Submit ---

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Validation
    if (lineItems.length === 0) { setErrorMessage(t('err_no_items')); return; }
    if (lineItems.some(li => !li.item_name.trim())) {
      setErrorMessage(t('err_item_no_product'));
      return;
    }
    if (lineItems.some(li => parseFloat(li.quantity) <= 0)) {
      setErrorMessage(t('err_item_no_qty'));
      return;
    }
    if (grandTotal <= 0) { setErrorMessage('Toplam tutar 0\'dan büyük olmalıdır.'); return; }

    setIsSaving(true);
    try {
      const payload = {
        entity_id: entity.id,
        transaction_type: transactionType,
        amount: parseFloat(grandTotal.toFixed(2)),
        due_date: dueDate || null,
        description: description.trim() || null,
        items: lineItems.map(li => ({
          item_id: li.item_id || null,
          item_name: li.item_name,
          quantity: parseFloat(li.quantity),
          unit_price: parseFloat(li.unit_price),
          tax_rate: parseFloat(li.tax_rate || 0),
          subtotal: parseFloat(li.subtotal),
        })),
      };

      let result;
      if (transactionData) {
        result = await window.api.transactions.update({ ...payload, id: transactionData.id });
      } else {
        result = await window.api.transactions.create(payload);
      }
      
      if (result.success) {
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      console.error('Invoice save error:', err);
      setErrorMessage('Kayıt sırasında bir hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  const isSale = transactionType === 'sale';
  const modalTitle = transactionData 
    ? (isSale ? t('invoice_modal_title_edit_sale') : t('invoice_modal_title_edit_purchase'))
    : (isSale ? t('invoice_modal_title_sale') : t('invoice_modal_title_purchase'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50
     dark:bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl
       border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex 
       flex-col max-h-[92vh]">

        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex 
        justify-between items-center bg-slate-50 dark:bg-slate-800/30 rounded-t-3xl shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isSale ? 'bg-emerald-50 dark:bg-emerald-500/10' :
              'bg-blue-50 dark:bg-blue-500/10'}`}>
              <FileText size={20} className={isSale ? 'text-emerald-600 dark:text-emerald-400' :
                'text-blue-600 dark:text-blue-400'} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">
                {modalTitle}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('invoice_for')}: <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {entity.title}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors
             p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">

            {/* Error message */}
            {errorMessage && (
              <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-xl
               text-sm text-center border border-red-100 dark:border-red-900/50">
                {errorMessage}
              </div>
            )}

            {/* ── Line Items Table ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider 
                flex items-center gap-1.5">
                  <Package size={12} />
                  {t('form_line_items')}
                </label>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 
                  dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-
                  dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 px-3 py-1.5 
                  rounded-lg transition-colors"
                >
                  <Plus size={14} />
                  {t('btn_add_item')}
                </button>
              </div>

              {/* Table header */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="grid grid-cols-[2fr_1fr_1fr_80px_1fr_40px] gap-0 bg-slate-50 
                dark:bg-slate-800/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest 
                border-b border-slate-200 dark:border-slate-700">
                  <div className="px-3 py-2.5">{t('table_product')}</div>
                  <div className="px-3 py-2.5">{t('table_qty')}</div>
                  <div className="px-3 py-2.5">{t('table_unit_price_short')}</div>
                  <div className="px-3 py-2.5">{t('table_tax')}</div>
                  <div className="px-3 py-2.5 text-right">{t('table_subtotal')}</div>
                  <div className="px-3 py-2.5"></div>
                </div>

                {/* Line item rows */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lineItems.map((li, index) => (
                    <div
                      key={li._key}
                      className="grid grid-cols-[2fr_1fr_1fr_80px_1fr_40px] gap-0 items-center 
                      hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                    >
                      {/* Product select + name input */}
                      <div className="px-2 py-2">
                        <div className="relative">
                          <select
                            className="w-full bg-transparent dark:text-white text-sm font-medium py-1.5 pr-6 pl-2 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:focus:border-blue-500 cursor-pointer appearance-none"
                            value={li.item_id}
                            onChange={e => handleItemSelect(index, e.target.value)}
                          >
                            <option value="" className="w-full bg-slate-50 dark:bg-slate-800 dark:text-white text-sm font-medium px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 mt-1">— Stoktan Seç —</option>
                            {items.map(itm => (
                              <option key={itm.id} value={itm.id} className="w-full bg-slate-50 dark:bg-slate-800 dark:text-white text-sm font-medium px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 mt-1">
                                {itm.name} ({itm.stock_quantity} {itm.unit})
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        {/* Manual name if not from stock */}
                        {!li.item_id && (
                          <input
                            type="text"
                            placeholder="Ürün Adı"
                            className="w-full bg-slate-50 dark:bg-slate-800 dark:text-white text-sm font-medium px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 mt-1"
                            value={li.item_name}
                            onChange={e => handleFieldChange(index, 'item_name', e.target.value)}
                          />
                        )}
                      </div>

                      {/* Quantity */}
                      <div className="px-2 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="w-full bg-slate-50 dark:bg-slate-800 dark:text-white text-sm font-medium px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                          value={li.quantity}
                          onChange={e => handleFieldChange(index, 'quantity', e.target.value)}
                        />
                      </div>

                      {/* Unit Price */}
                      <div className="px-2 py-2">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full bg-slate-50 dark:bg-slate-800 dark:text-white text-sm font-medium pl-2 pr-6 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                            value={li.unit_price}
                            onChange={e => handleFieldChange(index, 'unit_price', e.target.value)}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">₺</span>
                        </div>
                      </div>

                      {/* Tax rate */}
                      <div className="px-2 py-2">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            className="w-full bg-slate-50 dark:bg-slate-800 dark:text-white text-sm font-medium pl-2 pr-5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                            value={li.tax_rate}
                            onChange={e => handleFieldChange(index, 'tax_rate', e.target.value)}
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                        </div>
                      </div>

                      {/* Subtotal (read-only) */}
                      <div className="px-2 py-2 text-right">
                        <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200">
                          {parseFloat(li.subtotal || 0).toFixed(2)} ₺
                        </span>
                      </div>

                      {/* Remove row */}
                      <div className="px-1 py-2 flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(index)}
                          disabled={lineItems.length === 1}
                          className="p-1.5 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Summary */}
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
            </div>

            {/* ── Due Date ── */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Calendar size={12} />
                {t('form_due_date')}
              </label>

              {/* Quick select buttons */}
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

              {/* Custom date input */}
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

            {/* ── Description ── */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">{t('form_description')}</label>
              <textarea
                rows="2"
                className="w-full bg-slate-50 dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none font-medium transition-all"
                placeholder="Fatura ile ilgili not veya açıklama..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 rounded-b-3xl shrink-0">
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
        </form>
      </div>
    </div>
  );
}
