import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { ZenithLogo } from './ZenithLogo';

interface AuthFormProps {
  onSuccess?: () => void;
}

type AuthMode = 'login' | 'signup' | 'forgot';

export function AuthForm({ onSuccess }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        setSuccessMessage('Password reset email sent! Check your inbox.');
      }
      return;
    }

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        onSuccess?.();
      }
      return;
    }

    const { data, error } = await signUp(email, password);
    setLoading(false);

    if (error) {
      setError(error.message);
    } else if (data.session) {
      onSuccess?.();
    } else {
      setSuccessMessage('Account created! Check your email to confirm before signing in.');
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <ZenithLogo size={64} />
          </div>
          <h1 className="text-4xl font-bold tracking-widest bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
            ZENITH
          </h1>
          <p className="text-neutral-500 mt-2">
            Smart study planning, backwards from your exam
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-neutral-900 rounded-2xl shadow-xl p-8 border border-neutral-800">

          {/* Back button for forgot password */}
          {mode === 'forgot' && (
            <button
              onClick={() => switchMode('login')}
              className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-300 mb-4 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Sign In
            </button>
          )}

          <h2 className="text-xl font-semibold text-white mb-6">
            {mode === 'login' && 'Welcome back'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'forgot' && 'Reset your password'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-neutral-700 bg-neutral-950 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition placeholder:text-neutral-600"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            {/* Password Field — hidden on forgot mode */}
            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-neutral-300">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs text-amber-500 hover:text-amber-400 font-medium transition"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 rounded-lg border border-neutral-700 bg-neutral-950 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition placeholder:text-neutral-600"
                    placeholder={mode === 'login' ? 'Enter your password' : 'Create a password'}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-900/20 border border-red-800">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <p className="text-sm text-amber-400">{successMessage}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' && 'Sign In'}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'forgot' && 'Send Reset Email'}
                </>
              )}
            </button>
          </form>

          {/* Toggle between login and signup */}
          {mode !== 'forgot' && (
            <div className="mt-6 text-center">
              <p className="text-neutral-500">
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
                <button
                  onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  className="ml-2 text-amber-500 hover:text-amber-400 font-medium transition"
                >
                  {mode === 'login' ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
