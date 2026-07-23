import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Landmark,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

const fmtPrice = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtPct = (n) => `${(n ?? 0) > 0 ? '+' : ''}${Number(n || 0).toFixed(2)}%`;

// Nepali compact currency: Arba (1e9), Crore (1e7).
const fmtCompact = (n) => {
  const v = Number(n || 0);
  if (v >= 1e9) return `Rs. ${(v / 1e9).toFixed(2)} Ar`;
  if (v >= 1e7) return `Rs. ${(v / 1e7).toFixed(2)} Cr`;
  return `Rs. ${fmtPrice(v)}`;
};

export default function LandingPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    API.get('/public/overview')
      .then((r) => alive && setData(r.data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const nepse = data?.nepse || {};
  const ticker = data?.ticker || [];
  const gainers = data?.gainers || [];
  const losers = data?.losers || [];
  const listed = data?.listed_scrips;
  const nepseUp = (nepse.change ?? 0) >= 0;

  return (
    <div className="min-h-screen bg-white text-slate-800 selection:bg-emerald-200 selection:text-emerald-900">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-900 text-white">
              <TrendingUp size={17} strokeWidth={2.25} />
            </div>
            <span className="font-bold tracking-tight text-slate-900">PaperTrade</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Log in
            </button>
            <button
              onClick={() => navigate('/register')}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      {/* Live ticker (real data) */}
      {ticker.length > 0 && (
        <div className="border-b border-slate-100 bg-slate-50/60 overflow-hidden">
          <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center gap-6 text-xs">
            <span className="hidden sm:inline-flex items-center gap-1.5 shrink-0 font-semibold text-slate-500">
              <span
                className={`w-2 h-2 rounded-full ${nepse.is_open ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}
              />
              NEPSE {nepse.is_open ? 'Live' : 'Closed'}
            </span>
            <div className="overflow-hidden relative flex-1">
              <div className="animate-marquee-reverse flex gap-6 whitespace-nowrap">
                {[...ticker, ...ticker].map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 tabular-nums">
                    <span className="font-semibold text-slate-700">{t.symbol}</span>
                    <span className="text-slate-500">Rs. {fmtPrice(t.current_price)}</span>
                    <span className={(t.percent_change ?? 0) >= 0 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                      {fmtPct(t.percent_change)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-medium text-emerald-700 mb-6">
          🇳🇵 Built for NEPSE · Zero real-money risk
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 leading-[1.1] max-w-3xl mx-auto">
          Practice NEPSE trading
          <br />
          <span className="text-emerald-600">without risking a rupee.</span>
        </h1>
        <p className="mt-6 text-base md:text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
          Start with Rs 1,00,000 in virtual capital, trade live-priced Nepali
          stocks, and learn the mechanics of buying, selling, and managing a
          portfolio — no TMS account needed.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate('/register')}
            className="group px-6 py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            Start trading free
            <ArrowUpRight size={17} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-colors w-full sm:w-auto justify-center"
          >
            I have an account
          </button>
        </div>
      </section>

      {/* Live market snapshot (real data) */}
      <section className="max-w-6xl mx-auto px-6 pb-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                NEPSE Index
              </div>
              <div className="mt-1 flex items-end gap-3">
                <span className="text-4xl font-bold text-slate-900 tabular-nums">
                  {nepse.point != null ? fmtPrice(nepse.point) : '—'}
                </span>
                {nepse.change != null && (
                  <span
                    className={`mb-1 inline-flex items-center gap-1 text-sm font-semibold ${nepseUp ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {nepseUp ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                    {fmtPrice(nepse.change)} ({fmtPct(nepse.percent_change)})
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6 text-right">
              <Stat label="Turnover" value={nepse.turnover != null ? fmtCompact(nepse.turnover) : '—'} />
              <Stat label="Listed scrips" value={listed != null ? String(listed) : '—'} />
              <Stat label="Status" value={nepse.is_open ? 'Open' : 'Closed'} accent={nepse.is_open ? 'emerald' : 'slate'} />
            </div>
          </div>

          {/* Top movers */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <MoverList title="Top Gainers" rows={gainers} up />
            <MoverList title="Top Losers" rows={losers} up={false} />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Feature
            icon={<ShieldCheck size={20} />}
            title="Zero money at risk"
            body="Every account starts with Rs 1,00,000 in virtual capital. Learn how the market moves before risking real cash."
          />
          <Feature
            icon={<Landmark size={20} />}
            title="E-bank funding"
            body="Load funds from a simulated e-bank into your wallet, and request more with admin approval — just like a real broker flow."
          />
          <Feature
            icon={<Zap size={20} />}
            title="Live-priced execution"
            body="Orders match against real NEPSE prices with circuit limits and tick sizes enforced — a faithful, latency-free simulation."
          />
        </div>
      </section>

      {/* Stats band */}
      <section className="border-y border-slate-100 bg-slate-50/60">
        <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <Metric value="Rs 1,00,000" label="Starting capital" />
          <Metric value={listed != null ? `${listed}` : '370+'} label="NEPSE scrips" />
          <Metric value="Rs 0" label="Fees, ever" />
          <Metric value="100%" label="Simulated" />
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <span>© {new Date().getFullYear()} PaperTrade Nepal. Not affiliated with NEPSE, CDSC, or SEBON.</span>
        <span>Prices are simulated and for educational use only.</span>
      </footer>
    </div>
  );
}

function Stat({ label, value, accent = 'slate' }) {
  const color = accent === 'emerald' ? 'text-emerald-600' : 'text-slate-900';
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 text-sm font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function MoverList({ title, rows, up }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">{title}</div>
      <div className="divide-y divide-slate-100">
        {rows.length === 0 ? (
          <div className="py-6 text-sm text-slate-400">Market data unavailable.</div>
        ) : (
          rows.map((r) => (
            <div key={r.symbol} className="flex items-center justify-between py-2.5">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800">{r.symbol}</div>
                <div className="text-xs text-slate-400 truncate max-w-[180px]">{r.company_name}</div>
              </div>
              <div className="text-right tabular-nums shrink-0">
                <div className="text-sm font-semibold text-slate-800">Rs. {fmtPrice(r.current_price)}</div>
                <div className={`text-xs font-semibold inline-flex items-center gap-0.5 ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {fmtPct(r.percent_change)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Feature({ icon, title, body }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 mb-5">
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
    </div>
  );
}

function Metric({ value, label }) {
  return (
    <div>
      <div className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</div>
      <div className="mt-2 text-xs text-slate-500 uppercase tracking-wider font-semibold">{label}</div>
    </div>
  );
}
