import { useState, useEffect } from 'react';
import { Users, Package, Banknote, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, ShoppingCart, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalSuppliers: 0,
    totalItems: 0,
    lowStockItems: [],
    totalRevenue: 0,
    totalExpenses: 0,
    recentTransactions: []
  });

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [entities, items, transactions] = await Promise.all([
          window.api.customers.getAll(),
          window.api.items.getAll(),
          window.api.transactions.getAll()
        ]);

        const customers = entities.filter(e => e.type === 'Customer');
        const suppliers = entities.filter(e => e.type === 'Supplier');
        const lowStock = items.filter(i => i.stock_quantity <= 5);
        const revenue = transactions
          .filter(tx => tx.transaction_type === 'sale' || tx.transaction_type === 'payment_in')
          .reduce((sum, tx) => sum + tx.amount, 0);
        const expenses = transactions
          .filter(tx => tx.transaction_type === 'purchase' || tx.transaction_type === 'payment_out')
          .reduce((sum, tx) => sum + tx.amount, 0);

        setStats({
          totalCustomers: customers.length,
          totalSuppliers: suppliers.length,
          totalItems: items.length,
          lowStockItems: lowStock,
          totalRevenue: revenue,
          totalExpenses: expenses,
          recentTransactions: transactions.slice(0, 8)
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }
    };
    fetchAll();
  }, []);

  const netProfit = stats.totalRevenue - stats.totalExpenses;

  const getTypeColor = (type) => {
    if (type === 'sale' || type === 'payment_in') return 'text-emerald-500';
    return 'text-red-500';
  };

  const getTypeLabel = (type) => {
    switch(type) {
      case 'sale': return t('type_sale');
      case 'purchase': return t('type_purchase');
      case 'payment_in': return t('type_payment_in');
      case 'payment_out': return t('type_payment_out');
      default: return type;
    }
  };

  const isIncome = (type) => type === 'sale' || type === 'payment_in';

  return (
    <div className="space-y-6">
      <div className="fin-panel p-6">
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Hos geldiniz</p>
        <h2 className="text-2xl font-bold mt-1 capitalize text-slate-800 dark:text-slate-100">{user?.name}</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Sistemin anlik finans ve stok ozeti.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<TrendingUp size={22} className="text-emerald-500" />}
          label="Toplam Gelir"
          value={`${stats.totalRevenue.toFixed(2)} ₺`}
          color="text-emerald-600 dark:text-emerald-400"
          bg="bg-emerald-50 dark:bg-emerald-500/10"
        />
        <StatCard
          icon={<TrendingDown size={22} className="text-red-500" />}
          label="Toplam Gider"
          value={`${stats.totalExpenses.toFixed(2)} ₺`}
          color="text-red-600 dark:text-red-400"
          bg="bg-red-50 dark:bg-red-500/10"
        />
        <StatCard
          icon={<Banknote size={22} className={netProfit >= 0 ? "text-blue-500" : "text-red-500"} />}
          label="Net Kâr / Zarar"
          value={`${netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)} ₺`}
          color={netProfit >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}
          bg="bg-blue-50 dark:bg-blue-500/10"
        />
        <StatCard
          icon={<ShoppingCart size={22} className="text-purple-500" />}
          label="Toplam İşlem"
          value={stats.recentTransactions.length + "+"}
          color="text-purple-600 dark:text-purple-400"
          bg="bg-purple-50 dark:bg-purple-500/10"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button onClick={() => navigate('/islemler?quick=sale')} className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-700 dark:text-emerald-300">Hizli Satis</button>
        <button onClick={() => navigate('/islemler?quick=payment_in')} className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-500/10 px-4 py-3 text-sm font-bold text-blue-700 dark:text-blue-300">Hizli Tahsilat</button>
        <button onClick={() => navigate('/islemler?quick=purchase')} className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-500/10 px-4 py-3 text-sm font-bold text-indigo-700 dark:text-indigo-300">Hizli Alim</button>
        <button onClick={() => navigate('/islemler?quick=payment_out')} className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-500/10 px-4 py-3 text-sm font-bold text-red-700 dark:text-red-300">Hizli Odeme</button>
      </div>
      <div>
        <button
          onClick={async () => {
            try {
              const result = await window.api.system.createBackup();
              alert(`Yedek olusturuldu: ${result.path}`);
            } catch {
              alert('Yedek olusturulamadi');
            }
          }}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
        >
          Veri Yedegi Al
        </button>
      </div>

      {/* Entity + Inventory counts */}
      <div className="grid grid-cols-3 gap-4">
        <MiniCard icon={<Users size={18} className="text-blue-500"/>} label={t('sidebar_customers')} count={stats.totalCustomers} />
        <MiniCard icon={<Package size={18} className="text-indigo-500"/>} label={t('sidebar_suppliers')} count={stats.totalSuppliers} />
        <MiniCard icon={<Package size={18} className="text-slate-500"/>} label={t('sidebar_inventory')} count={stats.totalItems} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 fin-table-wrap">
          <div className="fin-panel-header">
            <h3 className="font-bold text-slate-800 dark:text-white text-sm">Son Hesap Hareketleri</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {stats.recentTransactions.length === 0 && (
              <p className="p-8 text-center text-slate-400 italic text-sm">{t('msg_no_transaction')}</p>
            )}
            {stats.recentTransactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${isIncome(tx.transaction_type) ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-red-50 dark:bg-red-500/10'}`}>
                    {isIncome(tx.transaction_type)
                      ? <ArrowUpRight size={16} className="text-emerald-500" />
                      : <ArrowDownLeft size={16} className="text-red-500" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{tx.entity_name}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">{getTypeLabel(tx.transaction_type)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-mono font-bold text-sm ${getTypeColor(tx.transaction_type)}`}>
                    {isIncome(tx.transaction_type) ? '+' : '-'}{tx.amount.toFixed(2)} ₺
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {new Date(tx.transaction_date).toLocaleDateString('tr-TR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Warning */}
        <div className="fin-table-wrap">
          <div className="fin-panel-header flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <h3 className="font-bold text-slate-800 dark:text-white text-sm">Düşük Stok Uyarısı</h3>
            {stats.lowStockItems.length > 0 && (
              <span className="ml-auto text-xs bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">
                {stats.lowStockItems.length}
              </span>
            )}
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {stats.lowStockItems.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-emerald-500 text-2xl mb-1">✓</p>
                <p className="text-slate-400 text-sm italic">Tüm ürünler yeterli stokta.</p>
              </div>
            )}
            {stats.lowStockItems.map(item => (
              <div key={item.id} className="flex items-center justify-between px-6 py-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.name}</p>
                <span className={`font-mono font-bold text-sm px-2 py-0.5 rounded-lg ${item.stock_quantity <= 0 ? 'bg-red-50 text-red-500 dark:bg-red-500/10' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                  {item.stock_quantity} {item.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable Stat Card
function StatCard({ icon, label, value, color, bg }) {
  return (
    <div className="fin-panel p-5">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${bg}`}>
        {icon}
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">{label}</p>
      <p className={`text-xl font-bold mt-1 font-mono ${color}`}>{value}</p>
    </div>
  );
}

// Reusable Mini Card
function MiniCard({ icon, label, count }) {
  return (
    <div className="fin-panel p-4 flex items-center gap-4">
      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
        {icon}
      </div>
      <div>
        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{count}</p>
      </div>
    </div>
  );
}
