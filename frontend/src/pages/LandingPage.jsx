import { useState } from 'react';
import { ArrowUpRight, Shield, Zap, BarChart3, HelpCircle, TrendingUp, Briefcase, Plus, BookOpen, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  // State to handle the new interactive Sector Rotation Board
  const [activeSector, setActiveSector] = useState('Hydro');

  // Mock NEPSE market data for the scrolling ticker tape
  const marketTickers = [
    { symbol: 'NEPSE Index', price: '2,065.40', change: '+12.45 (0.6%)', up: true },
    { symbol: 'NABIL', price: 'Rs. 485.00', change: '+2.1%', up: true },
    { symbol: 'NICA', price: 'Rs. 512.20', change: '-1.4%', up: false },
    { symbol: 'UPPER', price: 'Rs. 244.00', change: '+4.8%', up: true },
    { symbol: 'HDL', price: 'Rs. 1,890.00', change: '-0.8%', up: false },
    { symbol: 'GBIME', price: 'Rs. 195.50', change: '+0.0%', up: true },
  ];

  // Data for the new "NEPSE Sector Rotation" Interactive Section
  const sectorsData = {
    Hydro: {
      indexName: 'Hydropower Index',
      value: '2,421.50',
      change: '+3.4%',
      status: 'BULLISH',
      description: 'Hydros are highly volatile in NEPSE. Practice swing trading high-beta assets like UPPER, NHPC, and AHPC risk-free.',
      topScrips: ['UPPER (Rs. 244)', 'NHPC (Rs. 182)', 'SJCL (Rs. 290)'],
    },
    Banking: {
      indexName: 'Banking Index',
      value: '1,284.10',
      change: '+0.2%',
      status: 'STABLE',
      description: 'Commercial banks provide defensive play with solid dividends. Learn long-term portfolio modeling with NABIL, NICA, and EBL.',
      topScrips: ['NABIL (Rs. 485)', 'NICA (Rs. 512)', 'EBL (Rs. 540)'],
    },
    Microfinance: {
      indexName: 'Microfinance Index',
      value: '3,842.20',
      change: '-1.8%',
      status: 'CORRECTING',
      description: 'Microfinances often see rapid movements due to smaller float sizes. Learn to practice strict stop-loss strategies here.',
      topScrips: ['CBBL (Rs. 910)', 'SKBBL (Rs. 895)', 'NUBL (Rs. 1,020)'],
    },
  };

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-800 overflow-x-hidden selection:bg-emerald-200 selection:text-emerald-900">
      
      {/* Soft warm radial ambient glows for Light Theme */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] pointer-events-none opacity-40">
        <div className="absolute top-[-5%] left-[15%] w-[500px] h-[500px] rounded-full bg-emerald-200/40 blur-[120px]" />
        <div className="absolute top-[5%] right-[15%] w-[400px] h-[400px] rounded-full bg-sky-200/30 blur-[100px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_60%,transparent_100%)]" />
      </div>

      {/* NEPSE Ticker Tape */}
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur-md py-3 overflow-hidden relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-8 text-xs font-mono">
          <div className="overflow-hidden min-w-0 flex-1 relative">
            <div className="animate-marquee-reverse gap-8 flex">
              {[...marketTickers, ...marketTickers].map((ticker, index) => (
                <div key={index} className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-500 font-medium">{ticker.symbol}</span>
                  <span className="font-bold text-slate-900">{ticker.price}</span>
                  <span className={ticker.up ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                    {ticker.change}
                  </span>
                  <span className="text-slate-300 ml-4">•</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="whitespace-nowrap font-medium">NEPSE Live Feed</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-6 pt-20 pb-12 z-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-xs text-emerald-800 font-medium mb-6 animate-fade-in">
          <span>🇳🇵 Made for Nepal</span>
          <span className="text-emerald-400">•</span>
          <span>Zero-risk mock portfolio</span>
        </div>
        
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto text-slate-900 leading-[1.15]">
          Simulate NEPSE Trading. <br />
          <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">No TMS Account Needed.</span>
        </h1>
        
        <p className="mt-6 text-base md:text-lg text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
          Ditch the fear of losing real capital. Practice buy/sell mechanics, manage your simulated Demat portfolio, and build analytical confidence without real-world risk.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            onClick={() => navigate('/login')}
            className="group relative px-6 py-3 rounded-lg bg-emerald-600 text-white font-semibold transition hover:bg-emerald-700 flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center shadow-lg shadow-emerald-600/10"
          >
            Start Mock Trading
            <ArrowUpRight className="w-4 h-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
          <button 
            className="px-6 py-3 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition flex items-center gap-2 w-full sm:w-auto justify-center shadow-sm"
          >
            <HelpCircle className="w-4 h-4 text-slate-500" />
            How it works
          </button>
        </div>

        {/* PROPER WORKSPACE DASHBOARD LAYOUT */}
        <div className="mt-16 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl max-w-5xl mx-auto overflow-hidden text-left">
          <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden flex flex-col lg:flex-row h-[550px] font-sans">
            
            {/* Sidebar Mockup */}
            <aside className="w-full lg:w-48 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-row lg:flex-col p-4 justify-between lg:justify-start gap-4 shrink-0">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>NEPSE Workspace</span>
              </div>
              <nav className="flex flex-row lg:flex-col gap-1.5 text-xs text-slate-600 font-medium mt-0 lg:mt-6">
                <span className="px-3 py-1.5 rounded bg-emerald-50 text-emerald-800">Terminal</span>
                <span className="px-3 py-1.5 rounded hover:bg-slate-100">Demat Holdings</span>
                <span className="px-3 py-1.5 rounded hover:bg-slate-100">Order Book</span>
              </nav>
            </aside>

            {/* Main Dashboard Area */}
            <main className="flex-1 p-5 flex flex-col gap-4 overflow-hidden">
              
              {/* Metrics Header Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Demat Value</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">रू 5,12,450.00</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Unrealized Profit</p>
                  <p className="text-sm font-extrabold text-emerald-600 mt-0.5">+रू 12,450.00</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Buying Power</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">रू 1,84,200.00</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Net Return</p>
                  <p className="text-sm font-extrabold text-emerald-600 mt-0.5">+2.49%</p>
                </div>
              </div>

              {/* Lower Section: Chart + Watchlist Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0 flex-1">
                {/* Simplified Line Chart Grid */}
                <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between min-h-0">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">UPPER (Upper Tamakoshi Hydropower)</h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">Live index simulation - 1 Min Interval</p>
                    </div>
                    <span className="text-xs font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Rs. 244.00</span>
                  </div>
                  {/* Pseudo Line Chart graphic */}
                  <div className="h-28 w-full flex items-end gap-1.5 mt-4">
                    <div className="flex-grow bg-emerald-100 border-t-2 border-emerald-500 h-[25%] rounded-sm" />
                    <div className="flex-grow bg-emerald-100 border-t-2 border-emerald-500 h-[30%] rounded-sm" />
                    <div className="flex-grow bg-rose-100 border-t-2 border-rose-500 h-[20%] rounded-sm" />
                    <div className="flex-grow bg-emerald-100 border-t-2 border-emerald-500 h-[50%] rounded-sm" />
                    <div className="flex-grow bg-emerald-100 border-t-2 border-emerald-500 h-[65%] rounded-sm" />
                    <div className="flex-grow bg-emerald-100 border-t-2 border-emerald-500 h-[80%] rounded-sm animate-pulse" />
                  </div>
                </div>

                {/* Simulated Watchlist Panel */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between min-h-0">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 mb-3">Live Watchlist</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs p-1.5 hover:bg-slate-50 rounded">
                        <span className="font-semibold text-slate-700">NABIL</span>
                        <span className="text-emerald-600 font-semibold">Rs. 485.00 (+2.1%)</span>
                      </div>
                      <div className="flex justify-between items-center text-xs p-1.5 hover:bg-slate-50 rounded">
                        <span className="font-semibold text-slate-700">NICA</span>
                        <span className="text-rose-500 font-semibold">Rs. 512.20 (-1.4%)</span>
                      </div>
                      <div className="flex justify-between items-center text-xs p-1.5 hover:bg-slate-50 rounded">
                        <span className="font-semibold text-slate-700">HDL</span>
                        <span className="text-rose-500 font-semibold">Rs. 1,890.00 (-0.8%)</span>
                      </div>
                    </div>
                  </div>
                  <button className="w-full bg-slate-900 text-white text-[11px] font-bold py-2 rounded hover:bg-slate-800 transition text-center flex items-center justify-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add Scrip
                  </button>
                </div>
              </div>

              {/* Active Holdings Table (Proper Dashboard Feature) */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 overflow-x-auto">
                <h4 className="text-xs font-bold text-slate-900 mb-3">Active Demat Holdings</h4>
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-mono">
                      <th className="pb-2 font-normal">SCRIP</th>
                      <th className="pb-2 font-normal">KITTA</th>
                      <th className="pb-2 font-normal">AVG PRICE</th>
                      <th className="pb-2 font-normal">LIVE PRICE</th>
                      <th className="pb-2 font-normal text-right">UNREALIZED PNL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-2 font-bold text-slate-800">UPPER</td>
                      <td className="py-2">500</td>
                      <td className="py-2">Rs. 230.00</td>
                      <td className="py-2 text-slate-900">Rs. 244.00</td>
                      <td className="py-2 text-right text-emerald-600 font-semibold">+Rs. 7,000.00</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2 font-bold text-slate-800">NABIL</td>
                      <td className="py-2">300</td>
                      <td className="py-2">Rs. 470.00</td>
                      <td className="py-2 text-slate-900">Rs. 485.00</td>
                      <td className="py-2 text-right text-emerald-600 font-semibold">+Rs. 4,500.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </main>
          </div>
        </div>
      </section>

      {/* NEW INTERACTIVE SECTION: NEPSE SECTOR ROTATION BOARD */}
      <section className="max-w-7xl mx-auto px-6 py-20 border-t border-slate-200 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Text/Intro Column */}
          <div className="lg:col-span-5 space-y-5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/60 border border-emerald-200/50 text-xs text-emerald-800 font-semibold">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Interactive Simulator</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Practice NEPSE Sector Rotation
            </h2>
            <p className="text-slate-600 font-normal leading-relaxed text-sm md:text-base">
              NEPSE often experiences heavy momentum shifting between sectors (Hydros, Microfinances, Commercial Banks). Toggle between the sectors below to view how indices act during market cycles and which scrips are highly tracked.
            </p>

            {/* Toggle Buttons */}
            <div className="flex gap-2.5 pt-3">
              {Object.keys(sectorsData).map((sector) => (
                <button
                  key={sector}
                  onClick={() => setActiveSector(sector)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    activeSector === sector
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {sector} Sector
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Card Display Column */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-8 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl" />
            
            <div className="space-y-6">
              {/* Header inside Card */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-5">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">{sectorsData[activeSector].indexName}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-sm font-mono font-bold text-slate-800">{sectorsData[activeSector].value}</span>
                    <span className="text-xs font-mono font-bold text-emerald-600">{sectorsData[activeSector].change}</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 text-slate-700">
                  {sectorsData[activeSector].status}
                </span>
              </div>

              {/* Sector description */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Market Dynamics</span>
                <p className="text-slate-600 text-xs leading-relaxed">{sectorsData[activeSector].description}</p>
              </div>

              {/* Scrips to practice */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono block">Top Active Scrips</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {sectorsData[activeSector].topScrips.map((scrip, i) => (
                    <div key={i} className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center text-xs font-semibold text-slate-800 font-mono">
                      {scrip}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-6 py-20 border-t border-slate-200 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">
            Engineered for NEPSE’s Unique Environment
          </h2>
          <p className="mt-3 text-slate-500 font-light max-w-xl mx-auto text-sm md:text-base">
            Build your trade logic using real-time mock structures.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="group rounded-xl border border-slate-200 bg-white p-8 hover:border-slate-300 transition duration-300 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-6 text-emerald-600">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Zero Money At Risk</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Every profile starts with **Rs. 5,00,000 in virtual Nepalese Rupees**. Learn how the market cycles act before risking real cash.
            </p>
          </div>

          {/* Card 2 */}
          <div className="group rounded-xl border border-slate-200 bg-white p-8 hover:border-slate-300 transition duration-300 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-6 text-emerald-600">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Simulated Demat Balance</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Maintain a realistic Demat overview of your holdings. Track composite returns, average acquisition costs, and profit-and-loss margins.
            </p>
          </div>

          {/* Card 3 */}
          <div className="group rounded-xl border border-slate-200 bg-white p-8 hover:border-slate-300 transition duration-300 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-6 text-emerald-600">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Instant execution</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Orders execute cleanly based on actual mock prices, providing realistic simulations without the standard broker server latency.
            </p>
          </div>
        </div>
      </section>

      {/* Localized Stats */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-y border-slate-200 relative z-10 bg-slate-100/50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl font-extrabold tracking-tight text-slate-900">रू. 5 Lakhs</div>
            <div className="text-xs text-slate-500 mt-2 uppercase tracking-widest font-semibold">Mock Starting Balance</div>
          </div>
          <div>
            <div className="text-3xl font-extrabold tracking-tight text-slate-900">50+</div>
            <div className="text-xs text-slate-500 mt-2 uppercase tracking-widest font-semibold">NEPSE listed scrips</div>
          </div>
          <div>
            <div className="text-3xl font-extrabold tracking-tight text-slate-900">Zero</div>
            <div className="text-xs text-slate-500 mt-2 uppercase tracking-widest font-semibold">Hidden Fees</div>
          </div>
          <div>
            <div className="text-3xl font-extrabold tracking-tight text-slate-900">100%</div>
            <div className="text-xs text-slate-500 mt-2 uppercase tracking-widest font-semibold">Simulated Environment</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-400 border-t border-slate-200 mt-12">
        <div>
          <span>© {new Date().getFullYear()} PaperTrade Nepal. Not affiliated with CDSC, SEBON, or NEPSE.</span>
        </div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-slate-600 transition">MeroShare Info</a>
          <a href="#" className="hover:text-slate-600 transition">Broker Details</a>
          <a href="#" className="hover:text-slate-600 transition">Privacy Policy</a>
        </div>
      </footer>
    </div>
  );
}