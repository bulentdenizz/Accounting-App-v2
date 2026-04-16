import React from "react";
import { Search, Moon, Sun, Bell, Menu } from "lucide-react";

interface HeaderProps {
  toggleDarkMode: () => void;
  isDarkMode: boolean;
}

export function Header({ toggleDarkMode, isDarkMode }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 h-16 flex items-center justify-between px-4 lg:px-8 transition-colors duration-200">
      <div className="flex items-center lg:hidden">
        <button className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white focus:outline-none">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex justify-center lg:justify-start px-2 lg:px-0">
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm transition-colors"
            placeholder="Müşteri veya tedarikçi ara..."
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none relative">
          <span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-800"></span>
          <Bell className="w-6 h-6" />
        </button>

        <button 
          onClick={toggleDarkMode}
          className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none transition-colors"
        >
          {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
        </button>
        
        <div className="h-8 w-8 rounded-full bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center text-white font-bold text-sm cursor-pointer shadow-sm">
          AH
        </div>
      </div>
    </header>
  );
}
