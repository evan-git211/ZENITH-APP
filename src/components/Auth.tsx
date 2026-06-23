import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react';
import { ZenithLogo } from './ZenithLogo';

type Mode = 'login' | 'signup' | 'forgot';

export function AuthForm() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setPassword('');
    setShowPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      setLoading(false);
      if (error) setError(error.message);
      else setResetSent(true);
      return;
    }

    const { error } = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password);

    setLoading(false);

    if (error) {
      setError(error.message);
    } else if (mode === 'signup') {
      setSignupSuccess(true);
    }
  };

  const BG = 'linear-gradient(145deg, #080d1a 0%, #0d1526 60%, #07111f 100%)';

  if (signupSuccess || resetSent) {
    const icon = signupSuccess ? CheckCircle : Mail;
    const Icon = icon;
    const title = signupSuccess ? 'Check your inbox' : 'Reset link sent';
    const body = signupSuccess
      ? <>We sent a confirmation link to <span className="text-white font-medium">{email}</span>. Click it to activate your account.</>
      : <>Check <span className="text-white font-medium">{email}</span> for your password reset link.</>;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: BG }}>
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <Icon className="w-8 h-8" style={{ color: '#fbbf24' }} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">{title}</h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: '#94a3b8' }}>{body}</p>
          <button
            onClick={() => { setSignupSuccess(false); setResetSent(false); switchMode('login'); }}
            className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: '#fbbf24' }}
          >
            ← Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-start justify-center p-4"
      style={{ background: BG, paddingTop: 'max(4rem, 8vh)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo block */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: 'linear-gradient(145deg, #1c2d4a, #0f172a)',
              border: '1px solid rgba(251,191,36,0.28)',
              boxShadow: '0 0 36px rgba(251,191,36,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <ZenithLogo size={38} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Zenith</h1>
          <p className="mt-2 text-sm" style={{ color: '#64748b' }}>
            Your exam is set. Now build the plan to ace it.
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'linear-gradient(180deg, rgba(28,41,64,0.55) 0%, rgba(11,18,34,0.75) 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(28px)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.07)',
          }}
        >
          {/* Back button in forgot mode */}
          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="flex items-center gap-1.5 mb-5 text-sm transition-opacity hover:opacity-70"
              style={{ color: '#64748b' }}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </button>
          )}

          {/* Mode heading */}
          <p className="text-xs font-semibold uppercase tracking-widest mb-6" style={{ color: '#475569' }}>
            {mode === 'login' ? 'Sign in to your account' : mode === 'signup' ? 'Create a free account' : 'Reset your password'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#94a3b8' }}>
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#475569' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg text-sm text-white outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.14)',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'rgba(251,191,36,0.55)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(251,191,36,0.07)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password — hidden in forgot mode */}
            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium" style={{ color: '#94a3b8' }}>Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs transition-opacity hover:opacity-70"
                      style={{ color: '#fbbf24' }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#475569' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 rounded-lg text-sm text-white outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.14)',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = 'rgba(251,191,36,0.55)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(251,191,36,0.07)';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    placeholder={mode === 'login' ? 'Enter your password' : 'Min 6 characters'}
                    required
                    minLength={6}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                    style={{ color: '#475569' }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-2.5 p-3 rounded-lg text-sm text-red-400"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg text-sm font-bold flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#0c1322',
                boxShadow: '0 4px 20px rgba(245,158,11,0.3)',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 28px rgba(245,158,11,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(245,158,11,0.3)'; e.currentTarget.style.transform = 'none'; }}
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                : mode === 'login' ? 'Sign In'
                : mode === 'signup' ? 'Create Account'
                : 'Send Reset Link'
              }
            </button>
          </form>

          {/* Switch mode */}
          {mode !== 'forgot' && (
            <p className="mt-6 text-center text-sm" style={{ color: '#475569' }}>
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
              <button
                type="button"
                onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                className="ml-2 font-semibold transition-opacity hover:opacity-70"
                style={{ color: '#fbbf24' }}
              >
                {mode === 'login' ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
