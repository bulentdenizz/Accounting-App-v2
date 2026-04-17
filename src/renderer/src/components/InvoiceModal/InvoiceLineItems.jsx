import { Plus, Trash2, Package, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function InvoiceLineItems({ 
  lineItems, 
  items, 
  handleItemSelect, 
  handleFieldChange, 
  handleAddRow, 
  handleRemoveRow,
  t 
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Package size={12} />
          {t('form_line_items')}
        </label>
        <button
          type="button"
          onClick={handleAddRow}
          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={14} />
          {t('btn_add_item')}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_80px_1fr_40px] gap-0 bg-slate-50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-700">
          <div className="px-3 py-2.5">{t('table_product')}</div>
          <div className="px-3 py-2.5">{t('table_qty')}</div>
          <div className="px-3 py-2.5">{t('table_unit_price_short')}</div>
          <div className="px-3 py-2.5">{t('table_tax')}</div>
          <div className="px-3 py-2.5 text-right">{t('table_subtotal')}</div>
          <div className="px-3 py-2.5"></div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {lineItems.map((li, index) => (
            <div
              key={li._key}
              className="grid grid-cols-[2fr_1fr_1fr_80px_1fr_40px] gap-0 items-center hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
            >
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

              <div className="px-2 py-2 text-right">
                <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200">
                  {parseFloat(li.subtotal || 0).toFixed(2)} ₺
                </span>
              </div>

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
    </div>
  );
}
