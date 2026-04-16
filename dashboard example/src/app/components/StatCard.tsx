import React from "react";

interface StatCardProps {
  title: string;
  value: string;
  trend: string;
  trendPositive: boolean;
  icon: React.ReactNode;
}

export function StatCard({ title, value, trend, trendPositive, icon }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200 flex flex-col justify-between group hover:shadow-md">
      <div className="flex justify-between items-start">
        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20 transition-colors">
          {icon}
        </div>
        <span 
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            trendPositive 
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" 
              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {trend}
        </span>
      </div>
      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
      </div>
    </div>
  );
}
