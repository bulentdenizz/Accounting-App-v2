import { useState, useEffect } from 'react';
import { Plus, X, Banknote, User, ArrowUpRight, ArrowDownLeft, Trash2, Pencil, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import InvoiceModal from '../components/InvoiceModal';

export default function Transactions() {
  const { t } = useTranslation();

  const [transactions, setTransactions] = useState([]);
  const [entities, setEntities] = useState([]);
  const [items, setItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const emptyForm = {
    entity_id: '',
    transaction_type: 'sale',
    item_id: '',
    quantity: 1,
    amount: 0,
    description: ''
  };
  const [formData, setFormData] = useState(emptyForm);

  const fetchData = async () => {
    try {
      const [txs, ents, itms] = await Promise.all([
        window.api.transactions.getAll(),
        window.api.customers.getAll(),
        window.api.items.getAll()
      ]);
      setTransactions(txs);
      setEntities(ents);
      setItems(itms);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // FIX 1 & 5: Reset entity_id when transaction type changes to avoid wrong entity being saved
  const handleTypeChange = (newType) => {
    setFormData({ ...emptyForm, transaction_type: newType });
  };

  // FIX 4: Auto-calculate amount WITH KDV when item is selected
  const handleItemChange = (itemId, qty) => {
    const itm = items.find(i => i.id == itemId);
    if (itm) {
      const basePrice = itm.unit_price * qty;
      const withTax = basePrice * (1 + (itm.tax_rate || 0) / 100);
      setFormData(prev => ({ ...prev, item_id: itemId, amount: parseFloat(withTax.toFixed(2)) }));
    } else {
      setFormData(prev => ({ ...prev, item_id: itemId }));
    }
  };

  const handleQtyChange = (qty) => {
    const parsedQty = parseFloat(qty) || 1;
    const itm = items.find(i => i.id == formData.item_id);
    if (itm) {
      const basePrice = itm.unit_price * parsedQty;
      const withTax = basePrice * (1 + (itm.tax_rate || 0) / 100);
      setFormData(prev => ({ ...prev, quantity: parsedQty, amount: parseFloat(withTax.toFixed(2)) }));
    } else {
      setFormData(prev => ({ ...prev, quantity: parsedQty }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!formData.entity_id) {
      setErrorMessage(t('form_select_entity'));
      return;
    }
    if (formData.amount <= 0) {
      setErrorMessage("Please enter a valid amount.");
      return;
    }

    try {
      const result = await window.api.transactions.create(formData);
      if (result.success) {
        setIsModalOpen(false);
        setFormData(emptyForm);
        fetchData();
      }
    } catch (err) {
      // FIX 2: was `console.err` (typo), now `console.error`
      console.error("Save error:", err);
      setErrorMessage("Transaction failed. Check console for details.");
    }
  };

  const handleEdit = (tx) => {
    if (tx.transaction_type === 'sale' || tx.transaction_type === 'purchase') {
      // Use InvoiceModal for editing multi-item invoices
      setEditingTx(tx);
      setIsInvoiceModalOpen(true);
    } else {
      // Use simple modal for payments
      setFormData({
        id: tx.id,
        entity_id: tx.entity_id,
        transaction_type: tx.transaction_type,
        amount: tx.amount,
        description: tx.description || ''
      });
      setIsModalOpen(true);
    }
  };

  const handlePdf = async (tx) => {
    try {
      // Fetch full items first
      const items = await window.api.transactions.getItems(tx.id);
      await window.api.pdf.generate({ ...tx, items });
    } catch (err) {
      console.error("PDF Error:", err);
      alert("PDF oluşturulurken bir hata oluştu.");
    }
  };

  // FIX 6: Delete transaction with balance reversal
  const handleDelete = async (id) => {
    if (!window.confirm("Bu işlemi silmek istediğinizden emin misiniz? Bakiye ve stok otomatik geri alınır.")) return;
    try {
      await window.api.transactions.delete(id);
      fetchData();
    } catch(err) {
      console.error("Delete error:", err);
      alert("İşlem silinemedi.");
    }
  };

  const getTypeStyles = (type) => {
    switch (type) {
      case 'sale':        return { color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400', label: t('type_sale'), icon: <ArrowUpRight size={14} /> };
      case 'purchase':    return { color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400', label: t('type_purchase'), icon: <ArrowDownLeft size={14} /> };
      case 'payment_in':  return { color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400', label: t('type_payment_in'), icon: <Banknote size={14} /> };
      case 'payment_out': return { color: 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400', label: t('type_payment_out'), icon: <Banknote size={14} /> };
      default: return { color: 'text-slate-600 bg-slate-50', label: type, icon: null };
    }
  };

  // Filter entities based on type (Customers for sale/payment_in, Suppliers for purchase/payment_out)
  const filteredEntities = entities.filter(e => {
    if (formData.transaction_type === 'sale' || formData.transaction_type === 'payment_in') return e.type === 'Customer';
    if (formData.transaction_type === 'purchase' || formData.transaction_type === 'payment_out') return e.type === 'Supplier';
    return true;
  });

  const selectedItem = items.find(i => i.id == formData.item_id);

  return (
    <div className="h-full flex flex-col relative">
      {/* HEADER */}
      <header className="mb-6 flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {t('transactions_title')}
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700">
              {t('record_total').replace('{{count}}', transactions.length)}
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('transactions_desc')}</p>
        </div>
        <button
          onClick={() => { setFormData(emptyForm); setErrorMessage(''); setIsModalOpen(true); }}
          className="group flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 px-5 py-3 font-semibold rounded-xl transition-all duration-200 shadow-sm"
        >
          <div className="transition-transform duration-200 group-hover:scale-110">
            <Plus size={20} />
          </div>
          {t('btn_new_transaction')}
        </button>
      </header>

      {/* TABLE */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-bold">{t('table_date')}</th>
                <th className="px-6 py-4 font-bold">{t('table_type')}</th>
                <th className="px-6 py-4 font-bold">{t('table_entity')}</th>
                <th className="px-6 py-4 font-bold text-right">{t('table_amount')}</th>
                <th className="px-6 py-4 font-bold">{t('form_due_date')}</th>
                <th className="px-6 py-4 font-bold">Note</th>
                <th className="px-6 py-4 font-bold text-center">{t('table_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {transactions.length === 0 && (
                <tr><td colSpan="6" className="p-12 text-center text-slate-400 italic">{t('msg_no_transaction')}</td></tr>
              )}
              {transactions.map(tData => {
                const styles = getTypeStyles(tData.transaction_type);
                const isIncome = tData.transaction_type === 'sale' || tData.transaction_type === 'payment_in';
                return (
                  <tr key={tData.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4 text-xs font-mono text-slate-500 dark:text-slate-400">
                      {new Date(tData.transaction_date).toLocaleString('tr-TR')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${styles.color}`}>
                        {styles.icon}
                        {styles.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                      {tData.entity_name}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-mono font-bold text-sm ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                        {isIncome ? '+' : '-'}{tData.amount.toFixed(2)} ₺
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {tData.due_date ? (
                        (() => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const due = new Date(tData.due_date);
                          const diff = (due - today) / (1000 * 60 * 60 * 24);

                          let colorClass = 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'; // Future
                          if (diff < 0) colorClass = 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10'; // Overdue
                          else if (diff <= 3) colorClass = 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10'; // Soon

                          return (
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${colorClass}`}>
                              {due.toLocaleDateString('tr-TR')}
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-[10px] text-slate-300 dark:text-slate-600 italic">No Due</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 truncate max-w-[180px]">
                      {tData.description || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handlePdf(tData)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Download PDF"
                        >
                          <Printer size={16} />
                        </button>
                        <button 
                          onClick={() => handleEdit(tData)}
                          className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(tData.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete (reverses balance)"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">{t('btn_new_transaction')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {errorMessage && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-lg text-xs text-center border border-red-100 dark:border-red-900/50">
                  {errorMessage}
                </div>
              )}

              {/* Transaction Type Picker */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('table_type')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'sale', label: t('type_sale') },
                    { id: 'purchase', label: t('type_purchase') },
                    { id: 'payment_in', label: t('type_payment_in') },
                    { id: 'payment_out', label: t('type_payment_out') }
                  ].map(type => (
                    <button
                      key={type.id} type="button"
                      // FIX 1 & 5: Calls handleTypeChange which resets entity_id
                      onClick={() => handleTypeChange(type.id)}
                      className={`py-2.5 rounded-xl border text-[11px] font-bold transition-all ${formData.transaction_type === type.id ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-blue-400'}`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Entity (auto-filtered by type) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('table_entity')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User size={16} className="text-slate-400" />
                  </div>
                  <select required
                    className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                    value={formData.entity_id}
                    onChange={e => setFormData({ ...formData, entity_id: e.target.value })}
                  >
                    <option value="">-- {t('form_select_entity')} --</option>
                    {filteredEntities.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                  </select>
                </div>
                {filteredEntities.length === 0 && (
                  <p className="text-xs text-amber-500 pl-1 pt-0.5">
                    Bu işlem tipi için kayıtlı {formData.transaction_type === 'sale' || formData.transaction_type === 'payment_in' ? 'müşteri' : 'tedarikçi'} bulunamadı.
                  </p>
                )}
              </div>

              {/* Item + Qty (only for sale/purchase) */}
              {(formData.transaction_type === 'sale' || formData.transaction_type === 'purchase') && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('form_select_item')}</label>
                    <select
                      className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                      value={formData.item_id}
                      // FIX 4: Auto-calc amount with KDV
                      onChange={e => handleItemChange(e.target.value, formData.quantity)}
                    >
                      <option value="">-- Seçin --</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.name} (Stok: {i.stock_quantity} {i.unit})</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5 col-span-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('form_quantity')}</label>
                    <input type="number" step="0.01" min="0.01"
                      className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                      value={formData.quantity}
                      // FIX 4: Auto-recalculate on qty change
                      onChange={e => handleQtyChange(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* KDV Preview Badge — shown when item with tax is selected */}
              {selectedItem && selectedItem.tax_rate > 0 && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-700 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400 flex justify-between">
                  <span>KDV (%{selectedItem.tax_rate}) dahil otomatik hesaplandı</span>
                  <span className="font-bold font-mono">
                    {(selectedItem.unit_price * formData.quantity).toFixed(2)} ₺ + KDV = {formData.amount.toFixed(2)} ₺
                  </span>
                </div>
              )}

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('form_amount')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Banknote size={16} className="text-slate-400" />
                  </div>
                  <input type="number" step="0.01" min="0.01" required
                    className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-emerald-600 dark:text-emerald-400"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('form_description')}</label>
                <textarea rows="2"
                  className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none font-medium"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="pt-2">
                <button type="submit"
                  className="w-full py-3.5 text-sm font-extrabold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] transition-all active:scale-[0.98]">
                  {t('btn_save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* INVOICE MODAL (Multi-item) */}
      {isInvoiceModalOpen && (
        <InvoiceModal 
          entity={entities.find(e => e.id === editingTx?.entity_id) || { title: editingTx?.entity_name }}
          transactionType={editingTx?.transaction_type}
          transactionData={editingTx}
          onClose={() => { setIsInvoiceModalOpen(false); setEditingTx(null); }}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
