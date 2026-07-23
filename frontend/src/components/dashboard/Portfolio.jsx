// components/dashboard/Portfolio.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const Portfolio = () => {
  const navigate = useNavigate();

  const fetchPortfolio = useAppStore((s) => s.fetchPortfolio);
  const fetchWallet = useAppStore((s) => s.fetchWallet);

  // Pre-calculated summary + holdings come straight from the store.
  const summary = useAppStore((s) => s.portfolio.summary);
  const holdings = useAppStore((s) => s.portfolio.holdings) || [];
  const walletBalance = useAppStore((s) => s.portfolio.balance);
  const isLoading = useAppStore((s) => s.isLoading);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPortfolio();
    fetchWallet();
  }, [fetchPortfolio, fetchWallet]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPortfolio(), fetchWallet()]);
    setRefreshing(false);
  };

  // Safe fallback aggregations while the backend summary is still loading.
  const investedValue = summary?.total_invested_value || 0;
  const currentValue = summary?.total_current_value || 0;
  const profitLoss = summary?.total_profit_loss || 0;
  const profitLossPercentage = summary?.total_profit_loss_percentage || 0;

  const totalNetAssets = walletBalance + currentValue;
  const isOverallPositive = profitLoss >= 0;

  // Initial load = fetching with nothing to show yet.
  const initialLoading = isLoading && holdings.length === 0 && !summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Portfolio</h1>
          <p className="text-sm text-slate-500">
            Live performance analysis of your paper assets
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing || isLoading}
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing || isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Net Assets (wallet balance + stock market value) */}
        <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <span className="text-xs text-slate-500 font-medium">Net Assets</span>
            <p className="text-xl font-bold text-slate-800 tabular-nums truncate">
              Rs. {fmtMoney(totalNetAssets)}
            </p>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg text-blue-600 shrink-0">
            <Briefcase size={22} />
          </div>
        </div>

        {/* Invested Capital */}
        <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <span className="text-xs text-slate-500 font-medium">Invested Capital</span>
            <p className="text-xl font-bold text-slate-800 tabular-nums truncate">
              Rs. {fmtMoney(investedValue)}
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg text-slate-600 shrink-0">
            <Wallet size={22} />
          </div>
        </div>

        {/* Market Value */}
        <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <span className="text-xs text-slate-500 font-medium">Market Value</span>
            <p className="text-xl font-bold text-slate-800 tabular-nums truncate">
              Rs. {fmtMoney(currentValue)}
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg text-slate-600 shrink-0">
            <TrendingUp size={22} />
          </div>
        </div>

        {/* Overall Profit/Loss */}
        <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <span className="text-xs text-slate-500 font-medium">Overall Profit/Loss</span>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span
                className={`text-xl font-bold tabular-nums ${
                  isOverallPositive ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {isOverallPositive ? '+' : '−'} Rs. {fmtMoney(Math.abs(profitLoss))}
              </span>
              <span
                className={`text-xs font-bold inline-flex items-center tabular-nums ${
                  isOverallPositive ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {isOverallPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(profitLossPercentage).toFixed(2)}%
              </span>
            </div>
          </div>
          <div
            className={`p-3 rounded-lg shrink-0 ${
              isOverallPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}
          >
            {isOverallPositive ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
          </div>
        </div>
      </div>

      {/* Holdings */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Active Holdings</h2>
          <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2.5 py-1 rounded-full">
            {holdings.length} {holdings.length === 1 ? 'Position' : 'Positions'}
          </span>
        </div>

        {initialLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="text-sm font-medium">Loading your holdings…</p>
          </div>
        ) : holdings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 text-slate-400 mb-3">
              <Briefcase size={22} />
            </div>
            <p className="text-sm font-medium">No holdings yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              Buy your first stock to start building your portfolio.
            </p>
            <button
              onClick={() => navigate('/orders')}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Place your first trade <ArrowUpRight size={13} />
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3">Asset</th>
                  <th className="px-6 py-3 text-right">Quantity</th>
                  <th className="px-6 py-3 text-right">Avg. Price</th>
                  <th className="px-6 py-3 text-right">LTP</th>
                  <th className="px-6 py-3 text-right">Total Cost</th>
                  <th className="px-6 py-3 text-right">Current Value</th>
                  <th className="px-6 py-3 text-right">Gain/Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {holdings.map((position) => {
                  const isPositive = (position.profit_loss || 0) >= 0;
                  return (
                    <tr
                      key={position.symbol}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 tracking-wide">
                            {position.symbol}
                          </span>
                          <span className="text-xs text-slate-400 truncate max-w-[180px]">
                            {position.company_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                        {position.quantity} Kitta
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-600 tabular-nums whitespace-nowrap">
                        Rs. {fmtMoney(position.average_price)}
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-600 font-medium tabular-nums whitespace-nowrap">
                        Rs. {fmtMoney(position.current_price)}
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-600 tabular-nums whitespace-nowrap">
                        Rs. {fmtMoney(position.invested_value)}
                      </td>
                      <td className="px-6 py-3.5 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                        Rs. {fmtMoney(position.current_value)}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-bold tabular-nums whitespace-nowrap ${
                              isPositive ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {isPositive ? '+' : '−'} Rs.{' '}
                            {fmtMoney(Math.abs(position.profit_loss))}
                          </span>
                          <span
                            className={`text-xs font-bold inline-flex items-center gap-0.5 tabular-nums ${
                              isPositive ? 'text-emerald-500' : 'text-rose-500'
                            }`}
                          >
                            {isPositive ? (
                              <ArrowUpRight size={12} />
                            ) : (
                              <ArrowDownRight size={12} />
                            )}
                            {Math.abs(position.profit_loss_percentage || 0).toFixed(2)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Portfolio;
