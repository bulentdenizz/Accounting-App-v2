import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { 
  Calendar, TrendingUp, TrendingDown, DollarSign, Package, Percent, 
  ArrowUpRight, ArrowDownRight, RefreshCw, Layers, LayoutGrid
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Reports() {
  const { t } = useTranslation();
  
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const [stats, setStats] = useState(null);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const data = await window.api.reports.getStats(dateRange);
      const invVal = await window.api.reports.getInventoryValue();
      setStats(data);
      setInventoryValue(invVal);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  if (!stats && isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="animate-spin text-blue-500" size={40} />
          <p className="text-slate-500 font-medium tracking-tight">Raporlar Hazırlanıyor...</p>
        </div>
      </div>
    );
  }

  // Calculate high-level metrics
  const totalSales = stats?.summary.find(s => s.transaction_type === 'sale')?.total_excl || 0;
  const totalPurchases = stats?.summary.find(s => s.transaction_type === 'purchase')?.total_excl || 0;
  const outputKdv = stats?.summary.find(s => s.transaction_type === 'sale')?.total_tax || 0;
  const inputKdv = stats?.summary.find(s => s.transaction_type === 'purchase')?.total_tax || 0;
  const grossProfit = stats?.profitData.reduce((sum, p) => sum + (p.total_revenue - p.total_cost), 0) || 0;
  const netKdv = outputKdv - inputKdv;

  return (
    <div className="h-full space-y-8 animate-in fade-in duration-500">
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
             <LayoutGrid className="text-blue-600" size={32} />
             Finansal Raporlar
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">İşletmenizin performans ve vergi analizleri</p>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
           <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <Calendar size={16} className="text-slate-400" />
              <input 
                type="date" 
                className="bg-transparent border-none text-xs font-bold focus:ring-0 dark:text-white"
                value={dateRange.startDate}
                onChange={e => setDateRange({...dateRange, startDate: e.target.value})}
              />
              <span className="text-slate-300">→</span>
              <input 
                type="date" 
                className="bg-transparent border-none text-xs font-bold focus:ring-0 dark:text-white"
                value={dateRange.endDate}
                onChange={e => setDateRange({...dateRange, endDate: e.target.value})}
              />
           </div>
           <button 
             onClick={fetchReports}
             className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20"
           >
             <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
           </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="fin-panel p-6 group hover:border-emerald-500/50 transition-all border-l-4 border-l-emerald-500">
           <div className="flex justify-between items-start">
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Toplam Satış (Net)</p>
                 <h3 className="text-2xl font-black text-slate-900 dark:text-white font-mono">{totalSales.toFixed(2)} ₺</h3>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-2xl">
                 <ArrowUpRight size={20} />
              </div>
           </div>
           <p className="mt-4 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded inline-block">Dönem İçi Gelir</p>
        </div>

        <div className="fin-panel p-6 group hover:border-blue-500/50 transition-all border-l-4 border-l-blue-500">
           <div className="flex justify-between items-start">
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Brüt Kar</p>
                 <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">{grossProfit.toFixed(2)} ₺</h3>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-2xl">
                 <TrendingUp size={20} />
              </div>
           </div>
           <p className="mt-4 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded inline-block">Mal Maliyeti Düşülmüştür</p>
        </div>

        <div className="fin-panel p-6 group hover:border-violet-500/50 transition-all border-l-4 border-l-violet-500">
           <div className="flex justify-between items-start">
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net KDV Bakiyesi</p>
                 <h3 className={`text-2xl font-black font-mono ${netKdv > 0 ? 'text-violet-600' : 'text-emerald-600'}`}>
                    {Math.abs(netKdv).toFixed(2)} ₺
                 </h3>
              </div>
              <div className="p-3 bg-violet-50 dark:bg-violet-500/10 text-violet-600 rounded-2xl">
                 <Percent size={20} />
              </div>
           </div>
           <p className="mt-4 text-xs font-bold text-violet-600 bg-violet-50 dark:bg-violet-500/10 px-2 py-1 rounded inline-block">
              {netKdv > 0 ? 'Ödenecek KDV' : 'Devreden KDV'}
           </p>
        </div>

        <div className="fin-panel p-6 group hover:border-amber-500/50 transition-all border-l-4 border-l-amber-500">
           <div className="flex justify-between items-start">
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stok Değeri</p>
                 <h3 className="text-2xl font-black text-slate-900 dark:text-white font-mono">{inventoryValue.toFixed(0)} ₺</h3>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-2xl">
                 <Package size={20} />
              </div>
           </div>
           <p className="mt-4 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded inline-block">Mevcut Envanter Toplamı</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* KDV Trend Chart */}
        <div className="fin-panel p-8">
           <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-8 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-4">Aylık KDV Dağılımı (Trend)</h4>
           <div className="h-80 w-full font-mono text-xs">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={stats?.kdvTrend || []}>
                    <defs>
                       <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                       </linearGradient>
                       <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                    <Tooltip 
                       contentStyle={{backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff'}}
                       itemStyle={{fontWeight: 'bold'}}
                    />
                    <Legend verticalAlign="top" height={36}/>
                    <Area name="Hesaplanan KDV (Satış)" type="monotone" dataKey="output_kdv" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorOutput)" />
                    <Area name="İndirilecek KDV (Alış)" type="monotone" dataKey="input_kdv" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorInput)" />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Profit Data (Top Products) */}
        <div className="fin-panel p-8 flex flex-col">
           <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-8 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-4">Ürün Bazlı Karlılık (Top 10)</h4>
           <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs">
                 <thead>
                    <tr className="text-slate-400 font-bold">
                       <th className="pb-4">{t('table_product')}</th>
                       <th className="pb-4 text-right">Adet</th>
                       <th className="pb-4 text-right">Ciro</th>
                       <th className="pb-4 text-right">Karlılık</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {stats?.profitData.map((item, i) => {
                       const profit = item.total_revenue - item.total_cost;
                       const margin = (profit / item.total_revenue) * 100;
                       return (
                          <tr key={i} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                             <td className="py-4 font-bold text-slate-700 dark:text-slate-300">{item.item_name}</td>
                             <td className="py-4 text-right font-mono text-slate-500">{item.total_qty.toFixed(0)}</td>
                             <td className="py-4 text-right font-mono text-slate-700 dark:text-slate-200">{item.total_revenue.toFixed(2)} ₺</td>
                             <td className="py-4 text-right">
                                <div className="flex flex-col items-end">
                                   <span className="font-black text-blue-600 dark:text-blue-400 font-mono">+{profit.toFixed(2)} ₺</span>
                                   <span className="text-[9px] font-bold text-slate-400">%{margin.toFixed(1)} marj</span>
                                </div>
                             </td>
                          </tr>
                       );
                    })}
                    {stats?.profitData.length === 0 && (
                       <tr><td colSpan="4" className="py-12 text-center text-slate-400 italic">Bu dönem seçili satış bulunamadı.</td></tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      </div>

      {/* Financial Table Summary */}
      <div className="fin-panel p-8 overflow-hidden relative">
         <div className="absolute top-0 right-0 p-8 opacity-5">
            <DollarSign size={160} />
         </div>
         <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-8 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-4">Finansal Özet (Tablo)</h4>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-tighter">İşlem Hacmi</p>
               <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-500">Satışlar:</span>
                     <span className="font-bold text-emerald-600 font-mono">+{totalSales.toFixed(2)} ₺</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-mono">
                     <span className="text-slate-500">Alışlar:</span>
                     <span className="font-bold text-red-500">-{totalPurchases.toFixed(2)} ₺</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-sm font-black">
                     <span>Fark:</span>
                     <span className={totalSales - totalPurchases >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                        {(totalSales - totalPurchases).toFixed(2)} ₺
                     </span>
                  </div>
               </div>
            </div>

            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-tighter">KDV Dengesi</p>
               <div className="space-y-4 font-mono">
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-500">Hesaplanan:</span>
                     <span className="font-bold text-slate-700 dark:text-slate-200">+{outputKdv.toFixed(2)} ₺</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-500">İndirilecek:</span>
                     <span className="font-bold text-slate-700 dark:text-slate-200">-{inputKdv.toFixed(2)} ₺</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-sm font-black">
                     <span>Net:</span>
                     <span className={netKdv > 0 ? 'text-violet-600' : 'text-emerald-600'}>
                        {netKdv.toFixed(2)} ₺
                     </span>
                  </div>
               </div>
            </div>

            <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col justify-center">
                <div className="flex items-center gap-4">
                   <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20">
                      <TrendingUp size={32} />
                   </div>
                   <div>
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Performans Notu</h5>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-1 max-w-xs">
                         {grossProfit > 0 
                           ? "Bu dönem kârlı bir performans sergilenmektedir. Ürün bazlı marjları korumaya devam edin." 
                           : "Dönem verileri henüz kârlılık göstermiyor. Alış maliyetlerini veya giderleri kontrol edin."}
                      </p>
                   </div>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
}
