import React from "react";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "Paid" | "Deferred" | "Pending";
}

const transactions: Transaction[] = [
  {
    id: "TRX-101",
    date: "15 Nisan 2026",
    description: "10 Çuval Arpa Satışı (Ahmet Yılmaz)",
    amount: 2500,
    status: "Paid",
  },
  {
    id: "TRX-102",
    date: "15 Nisan 2026",
    description: "50 Çuval Buğday Kepeği Alımı (Toptancı A.Ş.)",
    amount: -8000,
    status: "Deferred",
  },
  {
    id: "TRX-103",
    date: "14 Nisan 2026",
    description: "5 Çuval Süt Yemi Satışı (Mehmet Can)",
    amount: 1750,
    status: "Paid",
  },
  {
    id: "TRX-104",
    date: "14 Nisan 2026",
    description: "Nakit Tahsilat (Hasan Usta)",
    amount: 5000,
    status: "Paid",
  },
  {
    id: "TRX-105",
    date: "13 Nisan 2026",
    description: "20 Çuval Tavuk Yemi Alımı",
    amount: -3200,
    status: "Pending",
  },
];

export function TransactionTable() {
  const getStatusBadge = (status: Transaction["status"]) => {
    switch (status) {
      case "Paid":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Ödendi
          </span>
        );
      case "Deferred":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
            <Clock className="w-3.5 h-3.5 mr-1" /> Vadeli
          </span>
        );
      case "Pending":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300">
            <AlertCircle className="w-3.5 h-3.5 mr-1" /> Bekliyor
          </span>
        );
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50/50 dark:bg-gray-800/50">
          <tr>
            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Tarih
            </th>
            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Açıklama
            </th>
            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Tutar
            </th>
            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Durum
            </th>
            <th scope="col" className="relative px-6 py-4">
              <span className="sr-only">Düzenle</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {transactions.map((transaction) => (
            <tr key={transaction.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                {transaction.date}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                {transaction.description}
              </td>
              <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${
                transaction.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-900 dark:text-white"
              }`}>
                {transaction.amount > 0 ? "+" : ""}
                ₺{Math.abs(transaction.amount).toLocaleString("tr-TR")}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {getStatusBadge(transaction.status)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <a href="#" className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Detay
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
