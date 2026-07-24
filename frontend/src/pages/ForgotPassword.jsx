import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore.js';
import { Mail, Lock, ArrowLeft, TrendingUp, Eye, EyeOff, KeyRound, CheckCircle2 } from 'lucide-react';

// Multi-step forgot-password flow: email -> OTP -> new password -> done.
// Mirrors the Login screen's design language (slate/emerald, rounded card, mono labels).
export default function ForgotPassword() {
  const navigate = useNavigate();
  const { requestPasswordReset, verifyResetOtp, resetPassword } = useAppStore();

  const [step, setStep] = useState('email'); // 'email' | 'otp' | 'password' | 'done'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const OTP_LENGTH = 6;

  // Step 1 — request a reset code.
  const handleRequest = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setIsLoading(true);
    const res = await requestPasswordReset(email.trim().toLowerCase());
    setIsLoading(false);
    if (res.success) {
      setStep('otp');
      setInfo(res.message || 'If an account exists for that email, a reset code has been sent.');
    } else {
      setError(res.error);
    }
  };

  // Resend the code (from the OTP step).
  const handleResend = async () => {
    setError(null);
    setInfo(null);
    setIsLoading(true);
    const res = await requestPasswordReset(email.trim().toLowerCase());
    setIsLoading(false);
    if (res.success) {
      setInfo('A new code has been sent. Check your inbox.');
      setOtp('');
    } else {
      setError(res.error);
    }
  };

  // Step 2 — verify the code (without consuming it).
  const handleVerify = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (otp.trim().length < OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code from your email.`);
      return;
    }
    setIsLoading(true);
    const res = await verifyResetOtp(email.trim().toLowerCase(), otp.trim());
    setIsLoading(false);
    if (res.success) {
      setStep('password');
    } else {
      setError(res.error);
    }
  };

  // Step 3 — set the new password (re-submits the code).
  const handleReset = async (e) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    const res = await resetPassword(email.trim().toLowerCase(), otp.trim(), newPassword);
    setIsLoading(false);
    if (res.success) {
      setStep('done');
    } else {
      setError(res.error);
      // A burned/expired code sends the user back to re-request one.
      if (/request a new/i.test(res.error || '')) {
        setStep('otp');
      }
    }
  };

  const labelCls = 'text-[10px] font-bold tracking-wider text-slate-400 font-mono block';
  const inputCls =
    'w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition';

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-6 selection:bg-emerald-200 selection:text-emerald-900">
      <div className="w-full max-w-md relative z-10">
        <button
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 transition mb-6 cursor-pointer group font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition group-hover:-translate-x-0.5" />
          Back to login
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 mb-4">
              {step === 'done' ? <CheckCircle2 className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {step === 'email' && 'Forgot Password'}
              {step === 'otp' && 'Enter Reset Code'}
              {step === 'password' && 'Set New Password'}
              {step === 'done' && 'Password Reset'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {step === 'email' && "We'll email you a one-time code to reset it"}
              {step === 'otp' && (
                <>Enter the {OTP_LENGTH}-digit code sent to <span className="font-semibold text-slate-700">{email}</span></>
              )}
              {step === 'password' && 'Choose a new password for your account'}
              {step === 'done' && 'Your password has been updated successfully'}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 text-xs bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-center">
              {error}
            </div>
          )}
          {info && !error && (
            <div className="mb-5 p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-center">
              {info}
            </div>
          )}

          {/* Step 1: email */}
          {step === 'email' && (
            <form onSubmit={handleRequest} className="space-y-5">
              <div className="space-y-1.5">
                <label className={labelCls}>EMAIL ADDRESS</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="yourname@domain.com"
                    className={inputCls}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-lg text-sm transition cursor-pointer shadow-md shadow-emerald-600/10"
              >
                {isLoading ? 'Sending code...' : 'Send reset code'}
              </button>
            </form>
          )}

          {/* Step 2: OTP */}
          {step === 'otp' && (
            <form onSubmit={handleVerify} className="space-y-5">
              <div className="space-y-1.5">
                <label className={labelCls}>VERIFICATION CODE</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    autoFocus
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                    placeholder="123456"
                    className={`${inputCls} tracking-[0.5em] font-mono text-center tabular-nums text-base`}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-lg text-sm transition cursor-pointer shadow-md shadow-emerald-600/10"
              >
                {isLoading ? 'Verifying...' : 'Verify code'}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(null); setInfo(null); setOtp(''); }}
                  className="text-slate-500 hover:text-slate-800 font-medium transition"
                >
                  Change email
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isLoading}
                  className="text-emerald-600 hover:text-emerald-700 font-semibold transition disabled:text-slate-400"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}

          {/* Step 3: new password */}
          {step === 'password' && (
            <form onSubmit={handleReset} className="space-y-5">
              <div className="space-y-1.5">
                <label className={labelCls}>NEW PASSWORD</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className={`${inputCls} pr-10`}
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
              <div className="space-y-1.5">
                <label className={labelCls}>CONFIRM PASSWORD</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className={inputCls}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-lg text-sm transition cursor-pointer shadow-md shadow-emerald-600/10"
              >
                {isLoading ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
          )}

          {/* Step 4: done */}
          {step === 'done' && (
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg text-sm transition cursor-pointer shadow-md shadow-emerald-600/10"
            >
              Back to login
            </button>
          )}

          {step !== 'done' && (
            <div className="text-center mt-8 pt-6 border-t border-slate-100 text-xs text-slate-500">
              Remembered your password?{' '}
              <Link to="/login" className="text-emerald-600 hover:text-emerald-700 font-semibold transition">
                Log in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
