import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore.js'; // Import Store
import { Mail, Lock, ArrowLeft, TrendingUp, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Extract auth actions and state from global store
  const { login, authError, isLoading } = useAppStore();

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Call the backend login action
    const success = await login(email, password);

    if (success) {
      // Admins land on the admin panel; everyone else on the trading workspace.
      const role = useAppStore.getState().user?.role;
      navigate(role === 'admin' ? '/admin' : '/');
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-6 selection:bg-emerald-200 selection:text-emerald-900">
      {/* Background elements omitted for space */}

      <div className="w-full max-w-md relative z-10">
        <button 
          onClick={() => navigate('/welcome')}
          className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 transition mb-6 cursor-pointer group font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition group-hover:-translate-x-0.5" />
          Back to landing page
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 mb-4">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Welcome Back</h2>
            <p className="text-xs text-slate-500 mt-1">Access your simulated NEPSE workspace</p>
          </div>

          {/* Show authentication error from backend if available */}
          {authError && (
            <div className="mb-5 p-3 text-xs bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-center">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
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

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold tracking-wider text-slate-400 font-mono block">PASSWORD</label>
                <Link to="/forgot-password" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">Forgot?</Link>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-lg text-sm transition cursor-pointer shadow-md shadow-emerald-600/10"
            >
              {isLoading ? "Signing in..." : "Log in to Workspace"}
            </button>
          </form>

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