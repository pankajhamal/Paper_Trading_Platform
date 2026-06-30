// pages/Portfolio.jsx
import React, { useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, Briefcase, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const Portfolio = () => {
  const fetchPortfolio = useAppStore((state) => state.fetchPortfolio);
  const fetchWallet = useAppStore((state) => state.fetchWallet);
  
  // Retrieve the pre-calculated summary and holdings lists directly from the store
  const summary = useAppStore((state) => state.portfolio.summary);
  const holdings = useAppStore((state) => state.portfolio.holdings) || [];
  const walletBalance = useAppStore((state) => state.portfolio.balance);

  useEffect(() => {
    fetchPortfolio();
    fetchWallet();
  }, [fetchPortfolio, fetchWallet]);

  // Safe Fallback Aggregations if backend summary is still loading
  const investedValue = summary?.total_invested_value || 0;
  const currentValue = summary?.total_current_value || 0;
  const profitLoss = summary?.total_profit_loss || 0;
  const profitLossPercentage = summary?.total_profit_loss_percentage || 0;

  const totalNetAssets = walletBalance + currentValue;
  const isOverallPositive = profitLoss >= 0;

  return (
    <div className="space-y-6">
      {/* Header Area */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Portfolio</h1>
        <p className="text-sm text-slate-500">Live performance analysis of your paper assets</p>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Net Assets (Wallet Balance + Stock Market Value) */}
        <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-medium">Net Assets</span>
            <p className="text-xl font-bold text-slate-800">
              रू {totalNetAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
            <Briefcase size={22} />
          </div>
        </div>

        {/* Invested Value */}
        <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-medium">Invested Capital</span>
            <p className="text-xl font-bold text-slate-800">
              रू {investedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg text-slate-600">
            <Wallet size={22} />
          </div>
        </div>

        {/* Current Holdings Market Value */}
        <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-medium">Market Value</span>
            <p className="text-xl font-bold text-slate-800">
              रू {currentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg text-slate-600">
            <TrendingUp size={22} />
          </div>
        </div>

        {/* Overall Profit/Loss */}
        <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-medium">Overall Profit/Loss</span>
            <div className="flex items-baseline space-x-1.5">
              <span className={`text-xl font-bold ${isOverallPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                रू {Math.abs(profitLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-xs font-bold inline-flex items-center ${isOverallPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {isOverallPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(profitLossPercentage).toFixed(2)}%
              </span>
            </div>
          </div>
          <div className={`p-3 rounded-lg ${isOverallPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {isOverallPositive ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Active Holdings</h2>
          <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2.5 py-1 rounded-full">
            {holdings.length} Positions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-4">Asset</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">Avg. Price</th>
                <th className="px-6 py-4">LTP (Current)</th>
                <th className="px-6 py-4">Total Cost</th>
                <th className="px-6 py-4">Current Value</th>
                <th className="px-6 py-4 text-right">Gain/Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {holdings.map((position) => {
                const isPositive = position.profit_loss >= 0;
                return (
                  <tr key={position.symbol} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 tracking-wide">{position.symbol}</span>
                        <span className="text-xs text-slate-400">{position.company_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">{position.quantity} Kitta</td>
                    <td className="px-6 py-4 text-slate-600">रू {position.average_price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium">रू {position.current_price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-slate-600">रू {position.invested_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800">रू {position.current_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`font-bold inline-flex items-center space-x-1 ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isPositive ? '+' : '-'}रू {Math.abs(position.profit_loss).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`text-xs font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isPositive ? '▲' : '▼'} {Math.abs(position.profit_loss_percentage).toFixed(2)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;