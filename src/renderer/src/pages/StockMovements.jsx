import { useState, useEffect } from 'react';
import { Package, X, ArrowUpRight, ArrowDownLeft, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function StockMovements() {
  const { t } = useTranslation();
  
  const [movements, setMovements] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 50;

  const [items, setItems] = useState([]);
  const [filterItemId, setFilterItemId] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adjustData, setAdjustData] = useState({
    item_id: '',
    new_quantity: '',
    reason: ''
  });
  const [errorMessage, setErrorMessage] = useState('');

  const fetchData = async () => {
    try {
      const txData = await window.api.inventory.getMovements({ 
        limit, 
        offset: (currentPage - 1) * limit,
        item_id: filterItemId || undefined
      });
      setMovements(txData.data);
      setTotalCount(txData.totalCount);

      if (items.length === 0) {
        const itms = await window.api.items.getAll();
        setItems(itms);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  useEffect(() => { fetchData(); }, [currentPage, filterItemId]);

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    
    if (!adjustData.item_id) {
      setErrorMessage('Lütfen ürün seçin.');
      return;
    }
    
    try {
      await window.api.inventory.adjustStock(adjustData);
      setIsModalOpen(false);
      setAdjustData({ item_id: '', new_quantity: '', reason: '' });
      fetchData();
    } catch (err) {
      setErrorMessage(err.message || 'Düzeltme kaydedilemedi.');
    }
  };

  const getMovementLabel = (type) => {
    switch (type) {
      case 'purchase_in': return { label: 'Alış Girişi', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400', icon: <ArrowDownLeft size={14} /> };
      case 'sale_out': return { label: 'Satış Çıkışı', color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400', icon: <ArrowUpRight size={14} /> };
      case 'return_in': return { label: 'İade Girişi (Müşteri)', color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400', icon: <ArrowDownLeft size={14} /> };
      case 'return_out': return { label: 'İade Çıkışı (Tedarikçi)', color: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-400', icon: <ArrowUpRight size={14} /> };
      case 'manual_adj': return { label: 'Sayım Düzeltmesi', color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300', icon: <AlertCircle size={14} /> };
      case 'opening_stock': return { label: 'Açılış', color: 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400', icon: <Package size={14} /> };
      default: return { label: type, color: 'text-slate-600 bg-slate-50', icon: null };
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      <header className="mb-6 flex justify-between items-center fin-panel p-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Stok Hareketleri
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700">
              {totalCount} Hareket
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Stok denetim izi ve geçmişi</p>
        </div>
        
        <div className="flex gap-4">
          <select 
            className="fin-input h-12 px-4 shadow-sm"
            value={filterItemId}
            onChange={e => {
              setFilterItemId(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Tüm Ürünler</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          
          <button
            onClick={() => { setAdjustData({ item_id: '', new_quantity: '', reason: '' }); setErrorMessage(''); setIsModalOpen(true); }}
            className="group flex items-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 px-5 py-3 font-semibold rounded-xl transition-all duration-200"
          >
            <div className="transition-transform duration-200 group-hover:scale-110">
              <AlertCircle size={20} />
            </div>
            Manuel Düzeltme
          </button>
        </div>
      </header>

      <div className="flex-1 fin-table-wrap flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="fin-table">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-bold">Tarih</th>
                <th className="px-6 py-4 font-bold">Ürün</th>
                <th className="px-6 py-4 font-bold">Hareket</th>
                <th className="px-6 py-4 font-bold">Değişim</th>
                <th className="px-6 py-4 font-bold">Kalan</th>
                <th className="px-6 py-4 font-bold text-center">İlgili Belge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {movements.length === 0 && (
                <tr><td colSpan="6" className="p-12 text-center text-slate-400 italic">Hiç hareket bulunamadı.</td></tr>
              )}
              {movements.map(m => {
                const typeStyle = getMovementLabel(m.movement_type);
                const isPositive = m.quantity_change > 0;
                
                return (
                  <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 text-xs font-mono text-slate-500 dark:text-slate-400">
                      {new Date(m.created_at).toLocaleString('tr-TR')}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                      {m.item_name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${typeStyle.color}`}>
                        {typeStyle.icon}
                        {typeStyle.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-sm">
                      <span className={isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}>
                        {isPositive ? '+' : '-'}{Math.abs(m.quantity_change)} {m.item_unit}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {m.balance_after} {m.item_unit}
                    </td>
                    <td className="px-6 py-4">
                      {m.transaction_id ? (
                        <div className="flex flex-col text-xs text-center justify-center">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            Fatura #{m.transaction_id}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                            {m.entity_name}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-center text-slate-400 italic">
                          {m.notes || 'Sistem Kaydı'}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalCount > limit && (
          <div className="flex items-center justify-between mt-4 mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 px-2">
              Sayfa {currentPage} / {Math.ceil(totalCount / limit)}
            </span>
            <div className="flex gap-2">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="px-4 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-700 disabled:opacity-50">Önceki</button>
              <button disabled={currentPage >= Math.ceil(totalCount / limit)} onClick={() => setCurrentPage(p => p + 1)} className="px-4 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-700 disabled:opacity-50">Sonraki</button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">Manuel Stok Düzeltme</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4">
              {errorMessage && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs text-center border border-red-100">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Ürün</label>
                <select required className="fin-input h-10 w-full"
                  value={adjustData.item_id}
                  onChange={e => setAdjustData({ ...adjustData, item_id: e.target.value })}
                >
                  <option value="">-- {t('form_select_item')} --</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name} (Stok: {i.stock_quantity})</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Yeni Miktar (Sayım Sonucu)</label>
                <input type="number" step="0.01" min="0" required
                  className="fin-input h-10 w-full"
                  value={adjustData.new_quantity}
                  onChange={e => setAdjustData({ ...adjustData, new_quantity: e.target.value })}
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Açıklama / Neden</label>
                <input type="text"
                  placeholder="Sayım farkı, zayi vs."
                  className="fin-input h-10 w-full"
                  value={adjustData.reason}
                  onChange={e => setAdjustData({ ...adjustData, reason: e.target.value })}
                />
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full py-3 text-sm font-extrabold bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow-lg transition-all">
                  Stoğu Güncelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
