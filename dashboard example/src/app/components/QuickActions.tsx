import React from "react";
import { ShoppingCart, PackagePlus, FileText, UserPlus } from "lucide-react";

export function QuickActions() {
  const actions = [
    {
      name: "Hızlı Satış",
      description: "Yeni müşteri satışı oluştur",
      icon: ShoppingCart,
      containerClasses: "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white shadow-md border border-transparent",
      iconWrapperClasses: "bg-white/20 dark:bg-black/20 text-white",
      titleClasses: "text-white",
      descClasses: "text-emerald-100"
    },
    {
      name: "Yeni Alım",
      description: "Tedarikçiden stok girişi yap",
      icon: PackagePlus,
      containerClasses: "bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 shadow-sm",
      iconWrapperClasses: "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
      titleClasses: "text-gray-900 dark:text-white",
      descClasses: "text-gray-500 dark:text-gray-400"
    },
    {
      name: "Müşteri Ekle",
      description: "Sisteme yeni cari hesap tanımla",
      icon: UserPlus,
      containerClasses: "bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 shadow-sm",
      iconWrapperClasses: "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
      titleClasses: "text-gray-900 dark:text-white",
      descClasses: "text-gray-500 dark:text-gray-400"
    },
    {
      name: "Rapor Al",
      description: "Günlük veya haftalık özet",
      icon: FileText,
      containerClasses: "bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 shadow-sm",
      iconWrapperClasses: "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
      titleClasses: "text-gray-900 dark:text-white",
      descClasses: "text-gray-500 dark:text-gray-400"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {actions.map((action, index) => (
        <button
          key={index}
          className={`group flex items-center p-4 rounded-2xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-gray-900 ${action.containerClasses}`}
        >
          <div className={`p-3 rounded-xl flex-shrink-0 transition-colors ${action.iconWrapperClasses}`}>
            <action.icon className="w-5 h-5" />
          </div>
          <div className="ml-4 text-left">
            <h3 className={`text-sm font-bold ${action.titleClasses}`}>
              {action.name}
            </h3>
            <p className={`text-xs mt-0.5 opacity-80 ${action.descClasses}`}>
              {action.description}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
