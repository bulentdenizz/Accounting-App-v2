import React from "react";
import { 
  LayoutDashboard, 
  Users, 
  Truck, 
  Package, 
  ArrowRightLeft,
  Wheat,
  Settings
} from "lucide-react";

export function Sidebar() {
  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard, active: true },
    { name: "Müşteriler", icon: Users },
    { name: "Tedarikçiler", icon: Truck },
    { name: "Stok", icon: Package },
    { name: "İşlemler", icon: ArrowRightLeft },
  ];

  return (
    <aside className="hidden lg:flex w-64 flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-screen transition-colors duration-200">
      <div className="p-6 flex items-center space-x-3">
        <div className="bg-emerald-600 p-2 rounded-xl text-white">
          <Wheat className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">Muhasebe<span className="text-emerald-600 dark:text-emerald-400">Pro</span></h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide">Yem Dükkanı Yönetimi</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <a
            key={item.name}
            href="#"
            className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              item.active 
                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" 
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.name}</span>
          </a>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <a
          href="#"
          className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <Settings className="w-5 h-5" />
          <span>Ayarlar</span>
        </a>
      </div>
    </aside>
  );
}
