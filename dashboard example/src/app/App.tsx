import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { StatCard } from "./components/StatCard";
import { TransactionTable } from "./components/TransactionTable";
import { QuickActions } from "./components/QuickActions";
import { TrendingUp, TrendingDown, AlertTriangle, Wallet } from "lucide-react";

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Apply dark mode class to the wrapper
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200 flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header toggleDarkMode={toggleDarkMode} isDarkMode={isDarkMode} />
        
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Quick Actions at the top for prominence */}
            <QuickActions />

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                title="Toplam Alacak" 
                value="₺24.500" 
                trend="+12%" 
                trendPositive={true}
                icon={<TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />} 
              />
              <StatCard 
                title="Toplam Borç" 
                value="₺12.300" 
                trend="-5%" 
                trendPositive={false}
                icon={<TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />} 
              />
              <StatCard 
                title="Kritik Stok Uyarıları" 
                value="3 Ürün" 
                trend="Acil" 
                trendPositive={false}
                icon={<AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />} 
              />
              <StatCard 
                title="Bugünkü Kasa" 
                value="₺4.200" 
                trend="+₺1.200" 
                trendPositive={true}
                icon={<Wallet className="w-6 h-6 text-blue-600 dark:text-blue-400" />} 
              />
            </div>

            {/* Main Section - Recent Transactions Table */}
            <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Son İşlemler</h2>
                <button className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300">Tümünü Gör</button>
              </div>
              <TransactionTable />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
