// components/ui/StaleBadge.jsx
// Marks figures that came from the stored snapshot rather than the live feed —
// the backend serves the last-known-good payload when nepse-bridge is down or
// NEPSE is closed, and prices that old should never be passed off as current.
import React from 'react';
import { Clock } from 'lucide-react';

const fmtAsOf = (value) => {
  if (!value) return 'earlier';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'earlier';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const StaleBadge = ({ asOf, className = '' }) => (
  <span
    title={`Live feed unavailable — showing the last data received${
      asOf ? ` on ${fmtAsOf(asOf)}` : ''
    }.`}
    className={`inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 border border-amber-200 ${className}`}
  >
    <Clock size={11} />
    As of {fmtAsOf(asOf)}
  </span>
);

export default StaleBadge;
