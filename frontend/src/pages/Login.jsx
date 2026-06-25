import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, TrendingUp } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    console.log("Logging in with:", { email, password });
    navigate('/'); // Redirect to the main workspace
  };

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-6 selection:bg-emerald-200 selection:text-emerald-900">
      
      {/* Background Soft Glows for Light Theme */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] left-[50%] -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-emerald-200/20 blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40" />
      </div>

      <div className="w-full max-w-md relative z-10">
        
        {/* Back Button */}
        <button 
          onClick={() => navigate('/welcome')}
          className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 transition mb-6 cursor-pointer group font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition group-hover:-translate-x-0.5" />
          Back to landing page
        </button>

        {/* Clean Light-Themed Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 mb-4">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Welcome Back</h2>
            <p className="text-xs text-slate-500 mt-1">Access your simulated NEPSE workspace</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            
            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold tracking-wider text-slate-400 font-mono block">EMAIL ADDRESS</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@domain.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold tracking-wider text-slate-400 font-mono block">PASSWORD</label>
                <a href="#" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">Forgot?</a>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition"
                />
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2 py-1">
              <input 
                type="checkbox" 
                id="remember"
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
              />
              <label htmlFor="remember" className="text-xs text-slate-500 font-medium cursor-pointer select-none">
                Remember this browser
              </label>
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg text-sm transition cursor-pointer shadow-md shadow-emerald-600/10"
            >
              Log in to Workspace
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="text-center mt-8 pt-6 border-t border-slate-100 text-xs text-slate-500">
            Don't have a practice profile?{' '}
            <Link to="/register" className="text-emerald-600 hover:text-emerald-700 font-semibold transition">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}