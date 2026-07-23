import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore'; // 1. Import your global store
import { Mail, Lock, User, ArrowLeft, ShieldCheck, Eye, EyeOff } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // 2. Subscribe to the registration state and actions
  const { registerUser, authError, isLoading } = useAppStore();

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!agreeTerms) {
      alert("Please agree to the simulated environment rules.");
      return;
    }
    
    // 3. Dispatch the registration request to the backend
    const success = await registerUser(fullName, email, password);
    
    if (success) {
      navigate('/'); // Redirect to the main workspace on success
    }
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
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create Account</h2>
            <p className="text-xs text-slate-500 mt-1">Get Rs 1,00,000 in virtual cash to start</p>
          </div>

          {/* 4. Display Backend Auth Errors if registration fails */}
          {authError && (
            <div className="mb-5 p-3 text-xs bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-center font-medium">
              {authError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-4">
            
            {/* Full Name Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold tracking-wider text-slate-400 font-mono block">FULL NAME</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Pankaj Hamal"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition"
                />
              </div>
            </div>

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
              <label className="text-[10px] font-bold tracking-wider text-slate-400 font-mono block">PASSWORD</label>
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

            {/* Agreement Box */}
            <div className="flex items-start gap-2.5 py-2">
              <input 
                type="checkbox" 
                id="agree"
                required
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
              />
              <label htmlFor="agree" className="text-[11px] text-slate-500 cursor-pointer select-none leading-relaxed">
                I understand this is a <span className="text-emerald-600 font-semibold">paper trading workspace</span> using fake money. No real capital or physical broker connections are involved.
              </label>
            </div>

            {/* Submit Button (Disabled during API call) */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-lg text-sm transition cursor-pointer shadow-md shadow-emerald-600/10"
            >
              {isLoading ? "Creating Profile..." : "Create Account"}
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="text-center mt-8 pt-6 border-t border-slate-100 text-xs text-slate-500">
            Already have an active workspace?{' '}
            <Link to="/login" className="text-emerald-600 hover:text-emerald-700 font-semibold transition">
              Log in instead
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}