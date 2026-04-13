import { useState, useEffect } from 'react';
import { Plus, X, AlignLeft, Search, Pencil, Trash2, PackageSearch, Tag, Layers, Percent } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Inventory() {
  const { t } = useTranslation();

  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]); // Tedarikçi listesi için
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [editingId, setEditingId] = useState(null);

  const emptyForm = { name: '', supplier_id: '', unit: '', unit_price: 0, tax_rate: 0, stock_quantity: 0 };
  const [formData, setFormData] = useState(emptyForm);

  const fetchData = async () => {
    try {
      const dbItems = await window.api.items.getAll();
      setItems(dbItems);
      
      // Müşterileri çekip sadece Tedarikçileri ayıklıyoruz
      const dbEntities = await window.api.customers.getAll();
      setSuppliers(dbEntities.filter(e => e.type === 'Supplier'));
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

    if(!formData.name.trim()) {
      setErrorMessage(t('err_empty_name'));
      return;
    }

    try {
      if (editingId) {
         await window.api.items.update({ ...formData, id: editingId });
      } else {
         await window.api.items.create(formData);
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

  const handleDelete = async (id, name) => {
    const message = t('msg_confirm_delete_item').replace('{{name}}', name);
    if(window.confirm(message)) {
      try {
         await window.api.items.delete(id);
         fetchData();
      } catch(e) {
         alert("Delete error!");
      }
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({ 
      name: item.name, 
      supplier_id: item.supplier_id || '', 
      unit: item.unit, 
      unit_price: item.unit_price, 
      tax_rate: item.tax_rate, 
      stock_quantity: item.stock_quantity 
    });
    setIsModalOpen(true);
  };

  const openModal = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setErrorMessage("");
    setIsModalOpen(true);
  };

  const filteredItems = items.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (m.supplier_name && m.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col relative">
      <header className="mb-6 flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {t('inventory_title')}
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700">
              {t('record_total').replace('{{count}}', items.length)}
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('inventory_desc')}</p>
        </div>
        
        <button 
           onClick={openModal}
           className="group flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 px-5 py-3 font-semibold rounded-xl transition-all duration-200 shadow-sm"
        >
           <div className="transition-transform duration-200 group-hover:scale-110">
             <Plus size={20} />
           </div>
           {t('btn_new_item')}
        </button>
      </header>

      <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
             <Search size={18} className="text-slate-400" />
          </div>
          <input 
             type="text" 
             placeholder={t('search_item')} 
             className="w-full bg-white dark:bg-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm"
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
          />
      </div>
      
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
             <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-bold">{t('table_name')}</th>
                    <th className="px-6 py-4 font-bold">{t('table_supplier')}</th>
                    <th className="px-6 py-4 font-bold">{t('table_unit')}</th>
                    <th className="px-6 py-4 font-bold text-right">{t('table_unit_price')}</th>
                    <th className="px-6 py-4 font-bold text-right">{t('table_tax_rate')}</th>
                    <th className="px-6 py-4 font-bold text-right">{t('table_stock_qty')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('table_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {filteredItems.length === 0 && (
                     <tr><td colSpan="7" className="p-12 text-center text-slate-400 italic">{t('msg_no_item')}</td></tr>
                  )}

                  {filteredItems.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {m.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                            {m.supplier_name || '-'}
                         </span>
                      </td>
                      <td className="px-6 py-4">
                         <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm">
                            {m.unit}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            {Number(m.unit_price).toFixed(2)} ₺
                         </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <span className="font-mono text-slate-500 dark:text-slate-400 text-sm">
                            %{m.tax_rate}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <span className={`font-mono font-bold text-sm ${m.stock_quantity > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
                            {m.stock_quantity}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(m)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title={t('btn_update')}>
                               <Pencil size={18} />
                            </button>
                            <button onClick={() => handleDelete(m.id, m.name)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
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
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
               <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                     {editingId ? t('modal_edit_item') : t('modal_new_item')}
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

                  {/* Ürün İsmi */}
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('form_name')}</label>
                     <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                           <AlignLeft size={16} className="text-slate-400" />
                        </div>
                        <input autoFocus required
                           className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                           value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                     </div>
                  </div>

                  {/* Tedarikçi Seçimi */}
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('form_supplier')}</label>
                     <select 
                        className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                        value={formData.supplier_id} 
                        onChange={e => setFormData({...formData, supplier_id: e.target.value })} 
                     >
                        <option value="">-- Bağımsız Liste / Seçilmedi --</option>
                        {suppliers.map(s => (
                           <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                     </select>
                  </div>

                  {/* Fiyat, KDV ve Adet Yanyana */}
                  <div className="grid grid-cols-3 gap-3">
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('form_unit_price')}</label>
                        <div className="relative">
                           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Tag size={14} className="text-slate-400" />
                           </div>
                           <input type="number" step="0.01" min="0" required
                              className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-2 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                              value={formData.unit_price} onChange={e => setFormData({...formData, unit_price: e.target.value})} />
                        </div>
                     </div>
                     
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('form_tax_rate')}</label>
                        <div className="relative">
                           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Percent size={14} className="text-slate-400" />
                           </div>
                           <input type="number" step="0.01" required
                              className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-2 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                              value={formData.tax_rate} onChange={e => setFormData({...formData, tax_rate: e.target.value})} />
                        </div>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('form_stock_qty')}</label>
                        <div className="relative">
                           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <PackageSearch size={14} className="text-slate-400" />
                           </div>
                           <input type="number" step="0.01" required
                              className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-2 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                              value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: e.target.value})} />
                        </div>
                     </div>
                  </div>
                  
                  {/* Birim (Adet vs) */}
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('form_unit')}</label>
                     <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                           <Layers size={16} className="text-slate-400" />
                        </div>
                        <input 
                           placeholder="Ex: Kg, Lt, Pcs"
                           className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                           value={formData.unit} 
                           onChange={e => setFormData({...formData, unit: e.target.value })} />
                     </div>
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
    </div>
  );
}
