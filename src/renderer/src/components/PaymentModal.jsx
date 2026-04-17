import { useState, useEffect } from 'react';
import { X, Banknote, History, CheckCircle, Calculator } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PaymentModal({ entity, type, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [openDocs, setOpenDocs] = useState([]);
  const [allocations, setAllocations] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const isCollection = type === 'payment_in'; // Tahsilat (Müşteriden)
  
  useEffect(() => {
    if (!entity?.id) return;
    window.api.transactions.getOpenDocuments({ 
        entity_id: entity.id, 
        type: entity.type // 'Customer' or 'Supplier'
    })
    .then(setOpenDocs)
    .catch(console.error);
  }, [entity]);

  const handleAutoDistribute = () => {
    const total = parseFloat(amount || 0);
    if (total <= 0) return;

    let remaining = total;
    const newAllocations = {};

    for (const doc of openDocs) {
      if (remaining <= 0) break;
      const docRem = Number(doc.remaining_amount || doc.amount);
      const pay = Math.min(remaining, docRem);
      newAllocations[doc.id] = pay.toFixed(2);
      remaining -= pay;
    }
    setAllocations(newAllocations);
  };

  const handleAllocationChange = (id, val) => {
    setAllocations(prev => ({ ...prev, [id]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const totalAmount = parseFloat(amount || 0);
    if (totalAmount <= 0) {
      setError('Lütfen geçerli bir tutar girin.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        entity_id: entity.id,
        transaction_type: type,
        amount: totalAmount,
        description: description || (isCollection ? 'Tahsilat' : 'Ödeme'),
        allocations: Object.entries(allocations)
                    .filter(([_, val]) => parseFloat(val) > 0)
                    .map(([id, val]) => ({
                      target_transaction_id: parseInt(id),
                      amount: parseFloat(val)
                    }))
      };

      const result = await window.api.transactions.create(payload);
      if (result.success) {
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      console.error(err);
      setError('İşlem kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalAllocated = Object.values(allocations).reduce((sum, v) => sum + parseFloat(v || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        <div className={`px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center ${isCollection ? 'bg-emerald-50/50 dark:bg-emerald-500/5' : 'bg-red-50/50 dark:bg-red-500/5'}`}>
          <div className="flex items-center gap-3">
             <div className={`p-2.5 rounded-xl ${isCollection ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20' : 'bg-red-100 text-red-600 dark:bg-red-500/20'}`}>
                <Banknote size={24} />
             </div>
             <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                    {isCollection ? 'Tahsilat Al' : 'Ödeme Yap'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">{entity.title}</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[85vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs text-center border border-red-100 dark:border-red-900/50">
              {error}
            </div>
          )}

          {/* Amount and Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">İşlem Tutarı</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Banknote size={18} className="text-slate-400" />
                </div>
                <input
                  type="number" step="0.01" min="0.01" autoFocus
                  className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:ring-2 focus:ring-blue-500 text-lg font-bold font-mono"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 font-mono">
                  Bakiye Düşümü (Dağıtılan)
               </label>
               <div className={`h-full flex items-center px-4 py-3 rounded-2xl border font-mono font-bold text-lg ${Math.abs(totalAllocated - parseFloat(amount || 0)) < 0.01 ? 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20' : 'bg-slate-50 border-slate-100 text-slate-400 dark:bg-slate-800/50 dark:border-slate-800'}`}>
                  {totalAllocated.toFixed(2)} ₺
               </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Açıklama</label>
            <input
              className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Örn: Nakit tahsilat, Banka havalesi..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Open Invoices Section */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center">
               <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                  <History size={14} /> Açık Belgeler
               </h4>
               <button 
                  type="button"
                  onClick={handleAutoDistribute}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-lg transition-colors border border-blue-100 dark:border-blue-500/20"
               >
                  <Calculator size={12} /> Otomatik Dağıt
               </button>
            </div>

            {openDocs.length === 0 ? (
               <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <CheckCircle size={24} className="mx-auto text-emerald-500 mb-2 opacity-50" />
                  <p className="text-sm text-slate-500">Açık fatura bulunmamaktadır.</p>
               </div>
            ) : (
               <div className="border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/50 overflow-hidden bg-white dark:bg-slate-900/50 shadow-sm">
                  {openDocs.map((doc) => {
                    const rem = Number(doc.remaining_amount || doc.amount);
                    return (
                      <div key={doc.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                             <span className="text-xs font-bold text-slate-400">#{doc.id}</span>
                             <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate">
                               {doc.invoice_number || 'Faturasız'}
                             </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                             {new Date(doc.transaction_date).toLocaleDateString('tr-TR')} • <span className="text-amber-600 font-bold">{rem.toFixed(2)} ₺ Kaldı</span>
                          </div>
                        </div>
                        <div className="relative">
                          <input
                            type="number" step="0.01" min="0" max={rem}
                            className="w-28 bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-bold font-mono text-right focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="0.00"
                            value={allocations[doc.id] || ''}
                            onChange={e => handleAllocationChange(doc.id, e.target.value)}
                          />
                        </div>
                      </div>
                    );
                  })}
               </div>
            )}
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              disabled={isSaving}
              className={`w-full py-4 text-sm font-bold text-white rounded-2xl shadow-lg transition-all active:scale-[0.98] ${isCollection ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20' : 'bg-red-600 hover:bg-red-500 shadow-red-500/20'}`}
            >
              {isSaving ? 'Kaydediliyor...' : (isCollection ? 'Tahsilatı Tamamla' : 'Ödemeyi Tamamla')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
