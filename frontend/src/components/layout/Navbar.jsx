// components/layout/Navbar.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Lightbulb, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import API from '../../services/api';
import AlertBell from './AlertBell';
import StaleBadge from '../ui/StaleBadge';

// Nepali-style compact currency: Arba (10^9) and Crore (10^7).
const formatTurnover = (value) => {
  if (value == null) return '—';
  if (value >= 1e9) return `Rs. ${(value / 1e9).toFixed(2)} Ar`;
  if (value >= 1e7) return `Rs. ${(value / 1e7).toFixed(2)} Cr`;
  return `Rs. ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

// Traded shares, compacted (e.g. 12.3M).
const compactNumber = (value) => {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
};

// A single label/value cell in the ticker strip.
const Metric = ({ label, children }) => (
  <div className="flex flex-col leading-tight">
    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
      {label}
    </span>
    <span className="text-sm font-bold text-slate-800 tabular-nums">
      {children}
    </span>
  </div>
);

const Navbar = () => {
  // Real headline data only — null fields render as an em dash, never faked.
  const [summary, setSummary] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await API.get('/market/summary');
      setSummary(data);
    } catch {
      setSummary(null); // stay honest: no live feed, no numbers
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  const isOpen = summary?.is_open === true;
  // Open/closed and live/stale are two different facts: the bulb reports the
  // exchange, the badge reports where these numbers came from.
  const isStale = summary?.is_stale === true;
  const change = summary?.change ?? 0;
  const percentChange = summary?.percent_change ?? 0;
  const up = change >= 0;

  return (
    <header className="bg-white border-b border-slate-200 h-16 px-6 flex items-center gap-6 select-none z-10">
      {/* Activity bulb: green when NEPSE is live, red when it is not. */}
      <div className="flex items-center gap-2">
        <Lightbulb
          size={22}
          className={isOpen ? 'text-emerald-500' : 'text-rose-500'}
          fill="currentColor"
          fillOpacity={isOpen ? 0.15 : 0.1}
        />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-slate-900 tracking-tight">
            NEPSE
          </span>
          <span
            className={`text-[10px] font-bold uppercase tracking-wide ${
              isOpen ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {isOpen ? 'Live' : 'Closed'}
          </span>
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200" />

      {/* Current index point + change % */}
      <Metric label="Point">
        {summary?.point != null
          ? summary.point.toLocaleString(undefined, { minimumFractionDigits: 2 })
          : '—'}
      </Metric>

      <Metric label="Change">
        {summary?.change != null ? (
          <span
            className={`flex items-center gap-0.5 ${
              up ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(percentChange).toFixed(2)}%
          </span>
        ) : (
          '—'
        )}
      </Metric>

      {/* Whole-market turnover + volume */}
      <Metric label="Turnover">{formatTurnover(summary?.turnover)}</Metric>
      <Metric label="Volume">{compactNumber(summary?.volume)}</Metric>

      {isStale && <StaleBadge asOf={summary?.as_of} />}

      {/* Triggered price alerts, pushed to the far right */}
      <div className="ml-auto">
        <AlertBell />
      </div>
    </header>
  );
};

export default Navbar;
