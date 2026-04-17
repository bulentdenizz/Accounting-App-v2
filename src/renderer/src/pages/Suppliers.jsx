import { useState, useEffect } from 'react';
import { Plus, X, Phone, AlignLeft, Search, Pencil, Trash2, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import InvoiceModal from '../components/InvoiceModal';
import StatementModal from '../components/StatementModal';
import PaymentModal from '../components/PaymentModal';
import { Banknote } from 'lucide-react';

export default function Suppliers() {
  const { t } = useTranslation();

  const [suppliers, setSuppliers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [invoiceTarget, setInvoiceTarget] = useState(null);
  const [statementTarget, setStatementTarget] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null);

  const emptyForm = { title: '', phone: '', type: 'Supplier', address: '' };
  const [formData, setFormData] = useState(emptyForm);

  const fetchData = async () => {
    try {
      const dbData = await window.api.customers.getAll();
      setSuppliers(dbData.filter(item => item.type === 'Supplier'));
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatPhone = (value) => {
    const numbers = value.replace(/[^\d]/g, '');
    let formatted = '';
    if (numbers.length > 0) formatted += numbers.substring(0, 1);
    if (numbers.length > 1) formatted += ' ' + numbers.substring(1, 4);
    if (numbers.length > 4) formatted += ' ' + numbers.substring(4, 7);
    if (numbers.length > 7) formatted += ' ' + numbers.substring(7, 11);
    return formatted;
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setErrorMessage("");

    if(!formData.title.trim()) {
      setErrorMessage(t('err_empty_name'));
      return;
    }
    
    const telRegex = /^0 5\d{2} \d{3} \d{4}$/;
    if (!telRegex.test(formData.phone)) {
       setErrorMessage(t('err_invalid_phone'));
       return;
    }

    try {
      if (editingId) {
         await window.api.customers.update({ ...formData, id: editingId });
      } else {
         await window.api.customers.create(formData);
      }
      
      setIsModalOpen(false);
      setFormData(emptyForm);
      setEditingId(null);
      fetchData(); 
    } catch (err) {
      console.error("Save error:", err);
      setErrorMessage("Error saving to database.");
    }
  };

  const handleDelete = async (id, title) => {
    const message = t('msg_confirm_delete_supplier').replace('{{name}}', title);
    if(window.confirm(message)) {
      try {
         await window.api.customers.delete(id);
         fetchData();
      } catch(e) {
         alert("Delete error!");
      }
    }
  };

  const handleEdit = (supplier) => {
    setEditingId(supplier.id);
    setFormData({ title: supplier.title, phone: supplier.phone, type: 'Supplier', address: supplier.address || '' });
    setIsModalOpen(true);
  };

  const openModal = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setErrorMessage("");
    setIsModalOpen(true);
  };

  const filteredSuppliers = suppliers.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (m.phone && m.phone.includes(searchQuery))
  );

  return (
    <div className="h-full flex flex-col relative">
      <header className="mb-6 flex justify-between items-center fin-panel p-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {t('suppliers_title')}
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700">
              {t('record_total').replace('{{count}}', suppliers.length)}
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('suppliers_desc')}</p>
        </div>
        
        <button 
           onClick={openModal}
           className="group flex items-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 px-5 py-3 font-semibold rounded-xl transition-all duration-200"
        >
           <div className="transition-transform duration-200 group-hover:scale-110">
             <Plus size={20} />
           </div>
           {t('btn_new_supplier')}
        </button>
      </header>

      <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
             <Search size={18} className="text-slate-400" />
          </div>
          <input 
             type="text" 
             placeholder={t('search_supplier')} 
             className="fin-input pl-11 pr-4"
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
          />
      </div>
      
      <div className="flex-1 fin-table-wrap flex flex-col">
          <div className="overflow-x-auto flex-1">
             <table className="fin-table">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-bold">{t('table_name')}</th>
                    <th className="px-6 py-4 font-bold">{t('table_contact')}</th>
                    <th className="px-6 py-4 font-bold text-right">{t('table_balance')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('table_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {filteredSuppliers.length === 0 && (
                     <tr><td colSpan="4" className="p-12 text-center text-slate-400 italic">{t('msg_no_supplier')}</td></tr>
                  )}

                  {filteredSuppliers.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {m.title}
                        </div>
                      </td>
                      <td className="px-6 py-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                         {m.phone ? <><Phone size={14} /> {m.phone}</> : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                         <span className={`font-mono font-bold text-sm ${m.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {m.balance.toFixed(2)} ₺
                         </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                               onClick={() => setStatementTarget(m)}
                               className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
                               title="Ekstre"
                            >
                               <FileText size={18} />
                            </button>
                            <button
                               onClick={() => setInvoiceTarget(m)}
                               className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                               title={t('btn_create_invoice')}
                            >
                               <FileText size={18} />
                            </button>
                            <button
                               onClick={() => setPaymentTarget(m)}
                               className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                               title="Ödeme Yap"
                            >
                               <Banknote size={18} />
                            </button>
                            <button onClick={() => handleEdit(m)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title={t('btn_update')}>
                               <Pencil size={18} />
                            </button>
                            <button onClick={() => handleDelete(m.id, m.title)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
                               <Trash2 size={18} />
                            </button>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
               <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                     {editingId ? t('modal_edit_supplier') : t('modal_new_supplier')}
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

                  <div className="space-y-1.5">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('form_name')}</label>
                     <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                           <AlignLeft size={16} className="text-slate-400" />
                        </div>
                        <input autoFocus required
                           className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                           value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                     </div>
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('form_phone')}</label>
                     <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                           <Phone size={16} className="text-slate-400" />
                        </div>
                        <input 
                           placeholder="0 555 555 5555"
                           className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                           value={formData.phone} 
                           onChange={e => setFormData({...formData, phone: formatPhone(e.target.value) })} />
                     </div>
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('form_address')}</label>
                     <textarea rows="2"
                        className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none font-medium"
                        value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                  </div>

                  <div className="pt-2">
                     <button type="submit"
                        className="w-full py-3.5 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] transition-all active:scale-[0.98]">
                        {editingId ? t('btn_update') : t('btn_save')}
                     </button>
                  </div>
               </form>
           </div>
        </div>
      )}

      {/* Invoice Modal */}
      {invoiceTarget && (
        <InvoiceModal
          entity={invoiceTarget}
          transactionType="purchase"
          onClose={() => setInvoiceTarget(null)}
          onSuccess={() => { setInvoiceTarget(null); fetchData(); }}
        />
      )}
      {statementTarget && (
        <StatementModal
          entity={statementTarget}
          onClose={() => setStatementTarget(null)}
        />
      )}
      {paymentTarget && (
        <PaymentModal
          entity={paymentTarget}
          type="payment_out"
          onClose={() => setPaymentTarget(null)}
          onSuccess={() => { setPaymentTarget(null); fetchData(); }}
        />
      )}
    </div>
  );
}
