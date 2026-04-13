import { useState, useEffect } from 'react';
import { Plus, X, Search, Banknote, Calendar, User, FileText, ShoppingCart, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Transactions() {
  const { t } = useTranslation();

  const [transactions, setTransactions] = useState([]);
  const [entities, setEntities] = useState([]);
  const [items, setItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  useEffect(() => {
    fetchData();
  }, []);

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
      console.err("Save error:", err);
      setErrorMessage("Transaction failed.");
    }
  };

  // Helper to get color/icon based on type
  const getTypeStyles = (type) => {
    switch (type) {
      case 'sale': return { color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10', label: t('type_sale'), icon: <ArrowUpRight size={16} /> };
      case 'purchase': return { color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10', label: t('type_purchase'), icon: <ArrowDownLeft size={16} /> };
      case 'payment_in': return { color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10', label: t('type_payment_in'), icon: <Banknote size={16} /> };
      case 'payment_out': return { color: 'text-red-600 bg-red-50 dark:bg-red-500/10', label: t('type_payment_out'), icon: <Banknote size={16} /> };
      default: return { color: 'text-slate-600 bg-slate-50', label: type, icon: null };
    }
  };

  return (
    <div className="h-full flex flex-col relative">
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
           onClick={() => setIsModalOpen(true)}
           className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/20 active:scale-95"
        >
           <Plus size={20} />
           {t('btn_new_transaction')}
        </button>
      </header>

      {/* TRANSACTION LIST */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
             <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-bold">{t('table_date')}</th>
                    <th className="px-6 py-4 font-bold">{t('table_type')}</th>
                    <th className="px-6 py-4 font-bold">{t('table_entity')}</th>
                    <th className="px-6 py-4 font-bold">{t('table_amount')}</th>
                    <th className="px-6 py-4 font-bold shrink-0">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {transactions.length === 0 && (
                     <tr><td colSpan="5" className="p-12 text-center text-slate-400 italic">{t('msg_no_transaction')}</td></tr>
                  )}

                  {transactions.map(tData => {
                    const styles = getTypeStyles(tData.transaction_type);
                    return (
                      <tr key={tData.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group">
                        <td className="px-6 py-4 text-xs font-mono text-slate-500 dark:text-slate-400">
                           {new Date(tData.transaction_date).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                           <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-transparent ${styles.color}`}>
                              {styles.icon}
                              {styles.label.toUpperCase()}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                           <div className="font-bold text-slate-800 dark:text-slate-200">
                               {tData.entity_name}
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`font-mono font-bold text-sm ${tData.transaction_type.includes('sale') || tData.transaction_type === 'payment_in' ? 'text-emerald-600' : 'text-red-500'}`}>
                              {tData.amount.toFixed(2)} ₺
                           </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400 truncate max-w-[200px]">
                           {tData.description || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
             </table>
          </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
               <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                     {t('btn_new_transaction')}
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                     <X size={20} />
                  </button>
               </div>

               <form onSubmit={handleSubmit} className="p-6 space-y-5">
                  {errorMessage && (
                    <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-lg text-xs text-center border border-red-100 dark:border-red-900/50">
                       {errorMessage}
                    </div>
                  )}

                  {/* Transaction Type */}
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
                            key={type.id}
                            type="button"
                            onClick={() => setFormData({...formData, transaction_type: type.id})}
                            className={`flex items-center justify-center py-2.5 rounded-xl border text-[11px] font-bold transition-all ${formData.transaction_type === type.id ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-blue-400'}`}
                          >
                             {type.label}
                          </button>
                        ))}
                     </div>
                  </div>

                  {/* Entity Selection */}
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('table_entity')}</label>
                     <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                           <User size={16} className="text-slate-400" />
                        </div>
                        <select required
                           className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                           value={formData.entity_id} onChange={e => setFormData({...formData, entity_id: e.target.value})}
                        >
                           <option value="">{t('form_select_entity')}</option>
                           {entities.filter(e => {
                               if(formData.transaction_type === 'sale' || formData.transaction_type === 'payment_in') return e.type === 'Customer';
                               if(formData.transaction_type === 'purchase' || formData.transaction_type === 'payment_out') return e.type === 'Supplier';
                               return true;
                           }).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                        </select>
                     </div>
                  </div>

                  {/* Item Selection (Optional - only for sale/purchase) */}
                  {(formData.transaction_type === 'sale' || formData.transaction_type === 'purchase') && (
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5 col-span-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('sidebar_inventory')}</label>
                          <select 
                             className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                             value={formData.item_id} onChange={e => {
                                const itm = items.find(i => i.id == e.target.value);
                                setFormData({...formData, item_id: e.target.value, amount: itm ? itm.unit_price * formData.quantity : formData.amount});
                             }}
                          >
                             <option value="">-- {t('form_select_item')} --</option>
                             {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.stock_quantity} {i.unit})</option>)}
                          </select>
                       </div>
                       <div className="space-y-1.5 col-span-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('form_quantity')}</label>
                          <input type="number" step="0.01" min="0.01"
                             className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                             value={formData.quantity} onChange={e => {
                                const qty = parseFloat(e.target.value);
                                const itm = items.find(i => i.id == formData.item_id);
                                setFormData({...formData, quantity: qty, amount: itm ? itm.unit_price * qty : formData.amount});
                             }} />
                       </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('form_amount')}</label>
                     <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                           <Banknote size={16} className="text-slate-400" />
                        </div>
                        <input type="number" step="0.01" min="0.01" required
                           className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-emerald-600 dark:text-emerald-400"
                           value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} />
                     </div>
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('form_description')}</label>
                     <textarea rows="2"
                        className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none font-medium text-slate-500"
                        value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                  </div>

                  <div className="pt-2">
                     <button type="submit"
                        className="w-full py-3.5 text-sm font-extrabold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] transition-all active:scale-[0.98]">
                        {t('btn_save')}
                     </button>
                  </div>
               </form>
           </div>
        </div>
      )}
    </div>
  );
}
