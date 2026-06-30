// components/layout/Navbar.jsx
import React, { useState, useEffect } from 'react';
import { Bell, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore'; // <-- 1. Import store

const Navbar = ({ backendUrl = '/api/market-summary' }) => {
  // 2. Retrieve state and fetch action from Zustand
  const balance = useAppStore((state) => state.portfolio.balance);
  const fetchWallet = useAppStore((state) => state.fetchWallet);

  const [marketData, setMarketData] = useState({
    nepse: { value: 0, change: 0, percentChange: 0 },
    sensind: { value: 0, change: 0, percentChange: 0 },
    turnover: 'रू 0.00',
    volume: '0',
    isOpen: false,
  });
  const [loading, setLoading] = useState(true);

  const fetchMarketData = async () => {
    try {
      setLoading(true);
      const response = await fetch(backendUrl);
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      setMarketData(data);
    } catch (err) {
      setMarketData({
        nepse: { value: 2015.41, change: -12.45, percentChange: -0.61 },
        sensind: { value: 356.12, change: 1.05, percentChange: 0.30 },
        turnover: 'रू 2.45 B',
        volume: '6,845,120',
        isOpen: false,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
    // 3. Trigger wallet balance fetch on component load
    fetchWallet(); 

    const interval = setInterval(fetchMarketData, 30000);
    return () => clearInterval(interval);
  }, [backendUrl, fetchWallet]);

  const renderIndex = (label, data) => {
    const isPositive = data.change >= 0;
    return (
      <div className="flex flex-col px-4 border-r border-slate-200 last:border-0">
        <span className="text-xs text-slate-500 font-medium">{label}</span>
        <div className="flex items-center space-x-1.5">
          <span className="text-sm font-semibold text-slate-800">
            {data.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span className={`flex items-center text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(data.change).toFixed(2)} ({data.percentChange.toFixed(2)}%)
          </span>
        </div>
      </div>
    );
  };

  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between select-none shadow-sm z-10">
      
      {/* Market Live/Closed Indicator */}
      <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
        <span className="relative flex h-2 w-2">
          {marketData.isOpen && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${marketData.isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
        </span>
        <span className="text-xs font-bold text-slate-600 tracking-wider">
          {marketData.isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
        </span>
      </div>

      {/* Indices & Summary Data */}
      <div className="hidden lg:flex items-center bg-slate-50 border border-slate-200 rounded-lg py-1 px-1">
        {renderIndex('NEPSE', marketData.nepse)}
        {renderIndex('SENSIND', marketData.sensind)}

        <div className="flex flex-col px-4 border-r border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Total Turnover</span>
          <span className="text-sm font-semibold text-slate-800">{marketData.turnover}</span>
        </div>

        <div className="flex flex-col px-4">
          <span className="text-xs text-slate-500 font-medium">Total Volume</span>
          <span className="text-sm font-semibold text-slate-800">{marketData.volume}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-3">
        <button 
          onClick={() => {
            fetchMarketData();
            fetchWallet(); // Also refresh the wallet balance on manual reload
          }} 
          disabled={loading}
          className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition duration-150"
          title="Refresh Data"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>

        <button className="relative p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition duration-150">
          <Bell size={19} />
          <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
        </button>

        <div className="flex items-center space-x-2 border-l border-slate-200 pl-3">
          <div className="text-right">
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Paper Balance</p>
            {/* 4. Display the dynamic, formatted balance */}
            <p className="text-sm font-bold text-emerald-600">
              रू {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;