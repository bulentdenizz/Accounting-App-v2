import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import InvoiceHeader from './InvoiceHeader';
import InvoiceLineItems from './InvoiceLineItems';
import InvoiceTotals from './InvoiceTotals';

const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const emptyLineItem = () => ({
  _key: Math.random(),
  item_id: '',
  item_name: '',
  quantity: 1,
  unit_price: 0,
  tax_rate: 0,
  subtotal: 0,
});

const calcSubtotal = (qty, price, tax) => {
  const base = parseFloat(qty || 0) * parseFloat(price || 0);
  return parseFloat((base * (1 + parseFloat(tax || 0) / 100)).toFixed(2));
};

export default function InvoiceModal({ entity, transactionType, onClose, onSuccess, transactionData }) {
  const { t } = useTranslation();

  const [items, setItems] = useState([]);
  const [lineItems, setLineItems] = useState([emptyLineItem()]);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [quickDue, setQuickDue] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    window.api.items.getAll().then(setItems).catch(console.error);

    if (transactionData) {
      setDescription(transactionData.description || '');
      setDueDate(transactionData.due_date ? transactionData.due_date.split('T')[0] : '');
      
      window.api.transactions.getItems(transactionData.id)
        .then(reqItems => {
          setLineItems(reqItems.map(it => ({
            ...it,
            _key: Math.random()
          })));
        })
        .catch(console.error);
    }
  }, [transactionData]);

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
    if (lineItems.length === 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuickDue = (days) => {
    setQuickDue(days);
    setDueDate(addDays(days));
  };

  const handleCustomDate = (val) => {
    setQuickDue(null);
    setDueDate(val);
  };

  const subtotalExclTax = lineItems.reduce((sum, li) => sum + parseFloat(li.quantity || 0) * parseFloat(li.unit_price || 0), 0);
  const totalTax = lineItems.reduce((sum, li) => {
    const base = parseFloat(li.quantity || 0) * parseFloat(li.unit_price || 0);
    return sum + base * (parseFloat(li.tax_rate || 0) / 100);
  }, 0);
  const grandTotal = lineItems.reduce((sum, li) => sum + parseFloat(li.subtotal || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        <InvoiceHeader 
          isSale={isSale} 
          modalTitle={modalTitle} 
          entityName={entity.title} 
          onClose={onClose} 
          t={t} 
        />

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6">
            {errorMessage && (
              <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm text-center border border-red-100 dark:border-red-900/50 mb-6">
                {errorMessage}
              </div>
            )}

            <InvoiceLineItems 
              lineItems={lineItems} 
              items={items} 
              handleItemSelect={handleItemSelect} 
              handleFieldChange={handleFieldChange} 
              handleAddRow={handleAddRow} 
              handleRemoveRow={handleRemoveRow} 
              t={t} 
            />

            <InvoiceTotals 
              subtotalExclTax={subtotalExclTax}
              totalTax={totalTax}
              grandTotal={grandTotal}
              isSale={isSale}
              dueDate={dueDate}
              quickDue={quickDue}
              handleQuickDue={handleQuickDue}
              handleCustomDate={handleCustomDate}
              setQuickDue={setQuickDue}
              setDueDate={setDueDate}
              description={description}
              setDescription={setDescription}
              onClose={onClose}
              isSaving={isSaving}
              transactionData={transactionData}
              t={t}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
