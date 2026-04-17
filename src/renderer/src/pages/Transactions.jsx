import { useState, useEffect } from 'react';
import { Plus, X, Banknote, User, ArrowUpRight, ArrowDownLeft, Trash2, Pencil, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import InvoiceModal from '../components/InvoiceModal';
import { useSearchParams } from 'react-router-dom';

export default function Transactions() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [cashStats, setCashStats] = useState({ in: 0, out: 0, net: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 20;
  const [entities, setEntities] = useState([]);
  const [items, setItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [openDocs, setOpenDocs] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const emptyLine = () => ({
    _key: Math.random(),
    item_id: '',
    item_name: '',
    quantity: 1,
    unit_price: 0,
    tax_rate: 0,
    subtotal: 0
  });

  const emptyForm = {
    entity_id: '',
    transaction_type: 'sale',
    item_id: '',
    quantity: 1,
    amount: 0,
    description: ''
  };
  const [formData, setFormData] = useState(emptyForm);
  const [lineItems, setLineItems] = useState([emptyLine()]);

  const fetchData = async () => {
    try {
      const [txData, ents, itms] = await Promise.all([
        window.api.transactions.getPage({ limit, offset: (currentPage - 1) * limit }),
        window.api.customers.getAll(),
        window.api.items.getAll()
      ]);
      setTransactions(txData.data);
      setTotalCount(txData.totalCount);
      setCashStats({ 
        in: txData.cashInTotal, 
        out: txData.cashOutTotal,
        net: txData.cashInTotal - txData.cashOutTotal
      });
      setEntities(ents);
      setItems(itms);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  useEffect(() => { fetchData(); }, [currentPage]);

  useEffect(() => {
    const quick = searchParams.get('quick');
    if (!quick) return;
    const allowed = ['sale', 'purchase', 'payment_in', 'payment_out', 'sale_return', 'purchase_return'];
    if (allowed.includes(quick)) {
      setFormData({ ...emptyForm, transaction_type: quick });
      setLineItems([emptyLine()]);
      setErrorMessage('');
      setIsModalOpen(true);
    }
    setSearchParams({});
  }, [searchParams, setSearchParams]);

  // FIX 1 & 5: Reset entity_id when transaction type changes to avoid wrong entity being saved
  const handleTypeChange = (newType) => {
    setFormData({ ...emptyForm, transaction_type: newType });
    setOpenDocs([]);
    setAllocations([]);
    setLineItems([emptyLine()]);
  };

  const calcSubtotal = (qty, price, tax) => {
    const base = Number(qty || 0) * Number(price || 0);
    return Number((base * (1 + Number(tax || 0) / 100)).toFixed(2));
  };

  const handleLineItemSelect = (index, itemId) => {
    const itm = items.find(i => i.id == itemId);
    setLineItems((prev) => {
      const next = [...prev];
      if (!itm) {
        next[index] = { ...next[index], item_id: '', item_name: '', unit_price: 0, tax_rate: 0, subtotal: 0 };
      } else {
        next[index] = {
          ...next[index],
          item_id: itemId,
          item_name: itm.name,
          unit_price: Number(itm.unit_price || 0),
          tax_rate: Number(itm.tax_rate || 0),
          subtotal: calcSubtotal(next[index].quantity, itm.unit_price, itm.tax_rate)
        };
      }
      return next;
    });
  };

  const handleLineFieldChange = (index, field, value) => {
    setLineItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      const li = next[index];
      next[index].subtotal = calcSubtotal(li.quantity, li.unit_price, li.tax_rate);
      return next;
    });
  };

  const addLine = () => setLineItems((prev) => [...prev, emptyLine()]);
  const removeLine = (index) => {
    setLineItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
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
      const payload = {
        ...formData,
        allocations: allocations.filter((a) => a.amount > 0),
      };
      if (isProductFlow) {
        payload.items = lineItems
          .filter((li) => Number(li.quantity) > 0 && (li.item_id || String(li.item_name || '').trim()))
          .map((li) => ({
            item_id: li.item_id || null,
            item_name: li.item_name || (items.find((it) => it.id == li.item_id)?.name || ''),
            quantity: Number(li.quantity || 0),
            unit_price: Number(li.unit_price || 0),
            tax_rate: Number(li.tax_rate || 0),
            subtotal: Number(li.subtotal || 0)
          }));
      }
      const result = await window.api.transactions.create(payload);
      if (result.success) {
        setIsModalOpen(false);
        setFormData(emptyForm);
        setOpenDocs([]);
        setAllocations([]);
        setLineItems([emptyLine()]);
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
      case 'sale_return': return { color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400', label: 'Musteri Iadesi', icon: <ArrowDownLeft size={14} /> };
      case 'purchase_return': return { color: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-400', label: 'Tedarikci Iadesi', icon: <ArrowUpRight size={14} /> };
      default: return { color: 'text-slate-600 bg-slate-50', label: type, icon: null };
    }
  };

  // Filter entities based on type (Customers for sale/payment_in, Suppliers for purchase/payment_out)
  const filteredEntities = entities.filter(e => {
    if (formData.transaction_type === 'sale' || formData.transaction_type === 'payment_in' || formData.transaction_type === 'sale_return') return e.type === 'Customer';
    if (formData.transaction_type === 'purchase' || formData.transaction_type === 'payment_out' || formData.transaction_type === 'purchase_return') return e.type === 'Supplier';
    return true;
  });

  useEffect(() => {
    const isPayment = formData.transaction_type === 'payment_in' || formData.transaction_type === 'payment_out';
    if (!isPayment || !formData.entity_id) {
      setOpenDocs([]);
      setAllocations([]);
      return;
    }
    const type = formData.transaction_type === 'payment_in' ? 'customer' : 'supplier';
    window.api.transactions.getOpenDocuments({ entity_id: Number(formData.entity_id), type })
      .then((docs) => {
        setOpenDocs(docs);
        setAllocations(docs.map((d) => ({ target_transaction_id: d.id, amount: 0 })));
      })
      .catch(() => {
        setOpenDocs([]);
        setAllocations([]);
      });
  }, [formData.entity_id, formData.transaction_type]);

  useEffect(() => {
    const isProductFlow = ['sale', 'purchase', 'sale_return', 'purchase_return'].includes(formData.transaction_type);
    if (!isProductFlow) return;
    const total = lineItems.reduce((sum, li) => sum + Number(li.subtotal || 0), 0);
    setFormData((prev) => ({ ...prev, amount: Number(total.toFixed(2)) }));
  }, [lineItems, formData.transaction_type]);

  const updateAllocation = (targetId, value) => {
    setAllocations((prev) => prev.map((a) => (
      a.target_transaction_id === targetId ? { ...a, amount: Number(value || 0) } : a
    )));
  };

  const isProductFlow = ['sale', 'purchase', 'sale_return', 'purchase_return'].includes(formData.transaction_type);

  return (
    <div className="h-full flex flex-col relative">
      {/* HEADER */}
      <header className="mb-6 flex justify-between items-center fin-panel p-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {t('transactions_title')}
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700">
              {t('record_total').replace('{{count}}', totalCount)}
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('transactions_desc')}</p>
        </div>
        <button
          onClick={() => { setFormData(emptyForm); setLineItems([emptyLine()]); setErrorMessage(''); setIsModalOpen(true); }}
          className="group flex items-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 px-5 py-3 font-semibold rounded-xl transition-all duration-200"
        >
          <div className="transition-transform duration-200 group-hover:scale-110">
            <Plus size={20} />
          </div>
          {t('btn_new_transaction')}
        </button>
      </header>

      <section className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="fin-panel p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Kasa Giris</p>
          <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{cashStats.in.toFixed(2)} ₺</p>
        </div>
        <div className="fin-panel p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Kasa Cikis</p>
          <p className="text-xl font-bold font-mono text-red-500 dark:text-red-400">{cashStats.out.toFixed(2)} ₺</p>
        </div>
        <div className="fin-panel p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Net Kasa</p>
          <p className={`text-xl font-bold font-mono ${cashStats.net >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500 dark:text-red-400'}`}>{cashStats.net.toFixed(2)} ₺</p>
        </div>
      </section>

      {/* TABLE */}
      <div className="flex-1 fin-table-wrap flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="fin-table">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-bold">{t('table_date')}</th>
                <th className="px-6 py-4 font-bold">{t('table_type')}</th>
                <th className="px-6 py-4 font-bold">{t('table_entity')}</th>
                <th className="px-6 py-4 font-bold text-right">{t('table_amount')}</th>
                <th className="px-6 py-4 font-bold">{t('form_due_date')}</th>
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
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
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

        {totalCount > limit && (
          <div className="flex items-center justify-between mt-4 mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 px-2">
              Sayfa {currentPage} / {Math.ceil(totalCount / limit)} ({totalCount} İşlem)
            </span>
            <div className="flex gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                Önceki
              </button>
              <button 
                disabled={currentPage >= Math.ceil(totalCount / limit)}
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
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

              <div className="fin-panel p-4 space-y-4">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">1) Islem Tipi ve Kisi</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('table_type')}</label>
                    <select
                      className="fin-input"
                      value={formData.transaction_type}
                      onChange={(e) => handleTypeChange(e.target.value)}
                    >
                      <option value="sale">{t('type_sale')}</option>
                      <option value="purchase">{t('type_purchase')}</option>
                      <option value="payment_in">{t('type_payment_in')}</option>
                      <option value="payment_out">{t('type_payment_out')}</option>
                      <option value="sale_return">Musteri Iadesi</option>
                      <option value="purchase_return">Tedarikci Iadesi</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('table_entity')}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User size={16} className="text-slate-400" />
                      </div>
                      <select required
                        className="fin-input pl-11"
                        value={formData.entity_id}
                        onChange={e => setFormData({ ...formData, entity_id: e.target.value })}
                      >
                        <option value="">-- {t('form_select_entity')} --</option>
                        {filteredEntities.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                      </select>
                    </div>
                    {filteredEntities.length === 0 && (
                      <p className="text-xs text-amber-500 pl-1 pt-0.5">
                        Bu islem tipi icin kayitli {formData.transaction_type === 'sale' || formData.transaction_type === 'payment_in' ? 'musteri' : 'tedarikci'} bulunamadi.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Item rows (multi-product) */}
              {isProductFlow && (
                <div className="fin-panel p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">2) Urun Detayi</h4>
                  <div className="space-y-2">
                    {lineItems.map((li, idx) => (
                      <div key={li._key} className="grid grid-cols-12 gap-2 items-center">
                        <select
                          className="fin-input col-span-5"
                          value={li.item_id}
                          onChange={(e) => handleLineItemSelect(idx, e.target.value)}
                        >
                          <option value="">-- Urun Sec --</option>
                          {items.map(i => <option key={i.id} value={i.id}>{i.name} (Stok: {i.stock_quantity} {i.unit})</option>)}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="fin-input col-span-2"
                          value={li.quantity}
                          onChange={(e) => handleLineFieldChange(idx, 'quantity', e.target.value)}
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="fin-input col-span-2"
                          value={li.unit_price}
                          onChange={(e) => handleLineFieldChange(idx, 'unit_price', e.target.value)}
                        />
                        <div className="col-span-2 text-right text-sm font-mono font-semibold text-slate-700 dark:text-slate-200">
                          {Number(li.subtotal || 0).toFixed(2)} ₺
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="col-span-1 p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addLine}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                    >
                      + Satir Ekle
                    </button>
                  </div>
                </div>
              )}

              {(formData.transaction_type === 'payment_in' || formData.transaction_type === 'payment_out') && openDocs.length > 0 && (
                <div className="fin-panel p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">2) Kapatilacak Belgeler</h4>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Kapatilacak Acik Belgeler</label>
                  <div className="max-h-40 overflow-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                    {openDocs.map((doc) => (
                      <div key={doc.id} className="p-2 flex items-center gap-2">
                        <span className="text-xs text-slate-500 min-w-28">#{doc.id} - {new Date(doc.transaction_date).toLocaleDateString('tr-TR')}</span>
                        <span className="text-xs font-mono text-amber-600 min-w-28">Kalan: {Number(doc.remaining_amount || doc.amount).toFixed(2)} ₺</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={Number(doc.remaining_amount || doc.amount)}
                          className="flex-1 bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs"
                          onChange={(e) => updateAllocation(doc.id, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount */}
              <div className="fin-panel p-4 space-y-3">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">3) Tutar ve Not</h4>
                <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('form_amount')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Banknote size={16} className="text-slate-400" />
                  </div>
                  <input type="number" step="0.01" min="0.01" required
                    className="fin-input pl-11 font-bold text-emerald-600 dark:text-emerald-400"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">{t('form_description')}</label>
                <textarea rows="2"
                  className="fin-input resize-none font-medium"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
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
