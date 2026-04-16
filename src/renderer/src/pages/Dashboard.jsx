import { useState, useEffect, useMemo } from 'react'
import {
  Users,
  Package,
  Banknote,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  ShoppingCart,
  AlertTriangle,
  Wallet,
  Plus,
  FileText,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'

export default function Dashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState({
    totalReceivables: 0,
    totalPayables: 0,
    totalItems: 0,
    lowStockItems: [],
    recentTransactions: [],
    dailyCash: 0,
    chartData: []
  })

  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [entities, items, transactions] = await Promise.all([
          window.api.customers.getAll(),
          window.api.items.getAll(),
          window.api.transactions.getAll()
        ])

        // Balances: Alacak (Customers), Borç (Suppliers)
        const receivables = entities
          .filter((e) => e.type === 'Customer')
          .reduce((sum, e) => sum + (e.balance || 0), 0)

        const payables = entities
          .filter((e) => e.type === 'Supplier')
          .reduce((sum, e) => sum + (e.balance || 0), 0)

        const lowStock = items.filter((i) => i.stock_quantity <= 5)

        // Daily Cash (simplified: net of today's payments)
        const today = new Date().toISOString().split('T')[0]
        const todayCash = transactions
          .filter((tx) => tx.transaction_date.startsWith(today))
          .reduce((sum, tx) => {
            if (tx.transaction_type === 'payment_in' || tx.transaction_type === 'sale')
              return sum + tx.amount
            if (tx.transaction_type === 'payment_out' || tx.transaction_type === 'purchase')
              return sum - tx.amount
            return sum
          }, 0)

        // Chart Data (last 7 days)
        const last7Days = [...Array(7)]
          .map((_, i) => {
            const d = new Date()
            d.setDate(d.getDate() - i)
            return d.toISOString().split('T')[0]
          })
          .reverse()

        const chartData = last7Days.map((date) => {
          const dayTxs = transactions.filter((tx) => tx.transaction_date.startsWith(date))
          const sales = dayTxs
            .filter((tx) => tx.transaction_type === 'sale')
            .reduce((s, t) => s + t.amount, 0)
          const purchases = dayTxs
            .filter((tx) => tx.transaction_type === 'purchase')
            .reduce((s, t) => s + t.amount, 0)
          return {
            date: new Date(date).toLocaleDateString('tr-TR', { weekday: 'short' }),
            Satış: sales,
            Alım: purchases
          }
        })

        setStats({
          totalReceivables: receivables,
          totalPayables: payables,
          totalItems: items.length,
          lowStockItems: lowStock,
          recentTransactions: transactions.slice(0, 5),
          dailyCash: todayCash,
          chartData: chartData
        })
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchAll()
  }, [])

  const getTypeColor = (type) => {
    if (type === 'sale' || type === 'payment_in') return 'text-emerald-600 dark:text-emerald-400'
    return 'text-red-600 dark:text-red-400'
  }

  const isIncome = (type) => type === 'sale' || type === 'payment_in'

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome & Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          title="Toplam Alacak"
          value={`${stats.totalReceivables.toLocaleString('tr-TR')} ₺`}
          trend="+12%"
          trendPositive={true}
          color="emerald"
        />
        <StatCard
          icon={<TrendingDown className="w-6 h-6" />}
          title="Toplam Borç"
          value={`${stats.totalPayables.toLocaleString('tr-TR')} ₺`}
          trend="-5%"
          trendPositive={false}
          color="red"
        />
        <StatCard
          icon={<AlertTriangle className="w-6 h-6" />}
          title="Stok Uyarıları"
          value={`${stats.lowStockItems.length} Ürün`}
          trend={stats.lowStockItems.length > 0 ? 'Kritik' : 'Normal'}
          trendPositive={stats.lowStockItems.length === 0}
          color="orange"
        />
        <StatCard
          icon={<Wallet className="w-6 h-6" />}
          title="Bugünkü Kasa"
          value={`${stats.dailyCash.toLocaleString('tr-TR')} ₺`}
          trend={stats.dailyCash >= 0 ? '+₺...' : '-₺...'}
          trendPositive={stats.dailyCash >= 0}
          color="blue"
        />
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickActionButton
          icon={<Plus className="w-5 h-5" />}
          label="Hızlı Satış"
          onClick={() => navigate('/islemler?quick=sale')}
          color="emerald"
        />
        <QuickActionButton
          icon={<ShoppingCart className="w-5 h-5" />}
          label="Alım Yap"
          onClick={() => navigate('/islemler?quick=purchase')}
          color="blue"
        />
        <QuickActionButton
          icon={<Users className="w-5 h-5" />}
          label="Müşteri Ekle"
          onClick={() => navigate('/musteriler')}
          color="purple"
        />
        <QuickActionButton
          icon={<FileText className="w-5 h-5" />}
          label="Raporlar"
          onClick={() => navigate('/vadeler')}
          color="slate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Charts Section */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                Satış ve Alım Grafiği
              </h3>
              <p className="text-sm text-slate-500">Son 7 günlük performans</p>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-xl">
              <button className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-700 shadow-sm rounded-lg text-emerald-600 dark:text-emerald-400">
                Haftalık
              </button>
              <button className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600">
                Aylık
              </button>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{
                    borderRadius: '16px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                />
                <Bar dataKey="Satış" fill="#10B981" radius={[6, 6, 0, 0]} barSize={20} />
                <Bar dataKey="Alım" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low Stock Warning */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-orange-100 dark:bg-orange-500/10 rounded-xl text-orange-600 dark:text-orange-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-white">Kritik Stoklar</h3>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto max-h-[320px] pr-2 scrollbar-thin">
            {stats.lowStockItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-4 animate-bounce">
                  <Package className="w-8 h-8" />
                </div>
                <p className="text-slate-500 text-sm font-medium">Harika! Tüm stoklar yeterli.</p>
              </div>
            ) : (
              stats.lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100/50 dark:border-slate-700/50"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {item.name}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium uppercase">{item.unit}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${item.stock_quantity <= 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}
                  >
                    {item.stock_quantity}
                  </span>
                </div>
              ))
            )}
          </div>
          <button className="mt-6 w-full py-3 text-sm font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 transition-colors">
            Tüm Envanteri Gör
          </button>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
              Son Hesap Hareketleri
            </h3>
          </div>
          <button
            onClick={() => navigate('/islemler')}
            className="text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline px-4 py-2"
          >
            Hepsini Gör
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Cari/Müşteri
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  İşlem Türü
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Tarih
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">
                  Tutar
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {stats.recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-400 italic">
                    Henüz işlem bulunmuyor.
                  </td>
                </tr>
              ) : (
                stats.recentTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors cursor-pointer"
                    onClick={() => navigate('/islemler')}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-xl ${isIncome(tx.transaction_type) ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}
                        >
                          {isIncome(tx.transaction_type) ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownLeft className="w-4 h-4" />
                          )}
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          {tx.entity_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                        {t(`type_${tx.transaction_type}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-slate-500 font-medium">
                        {new Date(tx.transaction_date).toLocaleDateString('tr-TR')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-black ${getTypeColor(tx.transaction_type)}`}>
                        {isIncome(tx.transaction_type) ? '+' : '-'}
                        {tx.amount.toLocaleString('tr-TR')} ₺
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, title, value, trend, trendPositive, color }) {
  const colors = {
    emerald:
      'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100/50 dark:border-emerald-500/10',
    red: 'text-red-600 bg-red-50 dark:bg-red-500/10 border-red-100/50 dark:border-red-500/10',
    orange:
      'text-orange-600 bg-orange-50 dark:bg-orange-500/10 border-orange-100/50 dark:border-orange-500/10',
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 border-blue-100/50 dark:border-blue-500/10'
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all group overflow-hidden relative">
      <div className="flex justify-between items-start mb-4">
        <div
          className={`p-3 rounded-2xl ${colors[color]} group-hover:scale-110 transition-transform`}
        >
          {icon}
        </div>
        <span
          className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${trendPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
        >
          {trend}
        </span>
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{value}</p>
      </div>
      {/* Decorative Gradient Overlay */}
      <div
        className={`absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br from-transparent to-${color}-500/5 rounded-full blur-2xl`}
      ></div>
    </div>
  )
}

function QuickActionButton({ icon, label, onClick, color }) {
  const colors = {
    emerald: 'bg-emerald-600 text-white shadow-emerald-500/20 hover:bg-emerald-700',
    blue: 'bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-700',
    purple: 'bg-indigo-600 text-white shadow-indigo-500/20 hover:bg-indigo-700',
    slate: 'bg-slate-800 text-white shadow-slate-500/20 hover:bg-slate-900'
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-4 rounded-2xl shadow-lg transition-all active:scale-95 ${colors[color]}`}
    >
      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
        {icon}
      </div>
      <span className="font-bold text-sm">{label}</span>
    </button>
  )
}
