import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { getRoleHomePath } from '../types';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M47.532 24.552c0-1.636-.132-3.2-.381-4.704H24.48v9.02h12.985c-.56 3.02-2.255 5.576-4.803 7.29v6.06h7.773c4.547-4.188 7.097-10.352 7.097-17.666z" fill="#4285F4"/>
      <path d="M24.48 48c6.516 0 11.984-2.16 15.978-5.856l-7.773-6.06c-2.16 1.452-4.92 2.304-8.205 2.304-6.312 0-11.664-4.26-13.572-9.984H2.864v6.252C6.84 42.984 15.12 48 24.48 48z" fill="#34A853"/>
      <path d="M10.908 28.404A14.385 14.385 0 0 1 10.08 24c0-1.536.264-3.024.828-4.404v-6.252H2.864A23.988 23.988 0 0 0 .48 24c0 3.888.924 7.572 2.384 10.656l8.044-6.252z" fill="#FBBC05"/>
      <path d="M24.48 9.612c3.552 0 6.732 1.224 9.24 3.624l6.924-6.924C36.456 2.388 30.996 0 24.48 0 15.12 0 6.84 5.016 2.864 13.344l8.044 6.252c1.908-5.724 7.26-9.984 13.572-9.984z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const { signIn, signInWithGoogle, user, loading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SSO config fetched from DB — null means not yet loaded
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoLoaded, setSsoLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from('sso_config')
      .select('enabled')
      .eq('provider', 'google')
      .maybeSingle()
      .then(({ data }) => {
        setSsoEnabled(data?.enabled ?? false);
        setSsoLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!loading && user) {
      navigate(getRoleHomePath(user.role), { replace: true });
    }
  }, [user, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      setError('Invalid email or password. Please try again.');
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setError('Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
    // on success the page redirects via OAuth redirect — no need to reset state
  }

  return (
    <div className="min-h-screen bg-bglight flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary-500/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-accent-500/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="bg-white rounded-2xl shadow-xl shadow-primary-900/8 border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-br from-primary-500 to-primary-600 px-8 py-10 text-center">
            <div className="inline-flex flex-col items-center">
              <span className="font-heading font-bold text-3xl text-white tracking-wide leading-none">
                HAPTIQ
              </span>
              <span
                className="h-0.5 mt-1 rounded-full w-full"
                style={{ backgroundColor: '#00A9CE' }}
              />
              <span className="font-heading font-semibold text-xs text-accent-300 tracking-widest uppercase mt-2">
                SkillSync
              </span>
            </div>
            <p className="mt-4 text-white/60 text-sm font-body">
              Sign in to your account to continue
            </p>
          </div>

          <div className="px-8 py-8 space-y-5">
            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 border border-red-100">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span className="font-body">{error}</span>
              </div>
            )}

            {/* Google SSO Button — always visible once config loaded; disabled when not enabled by admin */}
            {ssoLoaded && (
              <>
                <button
                  type="button"
                  onClick={ssoEnabled ? handleGoogleSignIn : undefined}
                  disabled={!ssoEnabled || googleLoading}
                  title={ssoEnabled ? undefined : 'Google sign-in is not enabled. Contact your administrator.'}
                  className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold font-heading transition-all shadow-sm
                    ${ssoEnabled
                      ? 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700 cursor-pointer'
                      : 'border-gray-150 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60'
                    }`}
                >
                  {googleLoading ? (
                    <Loader2 size={16} className="animate-spin text-gray-400" />
                  ) : (
                    <GoogleIcon />
                  )}
                  <span>
                    {googleLoading ? 'Redirecting…' : 'Continue with Google'}
                    {!ssoEnabled && !googleLoading && (
                      <span className="ml-1.5 text-[11px] font-normal font-body text-gray-400">(not configured)</span>
                    )}
                  </span>
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[11px] font-body text-gray-400 font-medium">or sign in with email</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold font-heading text-gray-600 uppercase tracking-wide">
                  Email Address
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@haptiq.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-bglight text-gray-800 text-sm font-body placeholder-gray-400 outline-none transition-all focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold font-heading text-gray-600 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 bg-bglight text-gray-800 text-sm font-body placeholder-gray-400 outline-none transition-all focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-heading font-semibold text-sm px-4 py-3 rounded-xl transition-all active:scale-[0.98]"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <LogIn size={16} />
                )}
                {submitting ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>

          <div className="px-8 pb-6">
            <div className="rounded-xl bg-bglight border border-gray-100 p-4">
              <p className="text-xs font-semibold font-heading text-gray-500 uppercase tracking-wide mb-3">
                Demo Credentials
              </p>
              <div className="space-y-3 text-xs font-body">
                <div>
                  <p className="text-[10px] font-semibold font-heading text-gray-400 uppercase tracking-wider mb-1.5">Employees</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {['employee1','employee2','employee3','employee4','employee5'].map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => { setEmail(`${e}@haptiq.com`); setPassword('emp@123'); }}
                        className="col-span-2 grid grid-cols-2 text-left hover:bg-gray-100 rounded-lg px-2 py-1 -mx-2 transition-colors group"
                      >
                        <span className="font-medium text-gray-700 group-hover:text-primary-600 truncate">{e}@haptiq.com</span>
                        <span className="text-gray-400">emp@123</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-[10px] font-semibold font-heading text-gray-400 uppercase tracking-wider mb-1.5">TMG / Mgmt / Admin</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {[
                      { email: 'tmg1@haptiq.com',  pass: 'tmg@123'  },
                      { email: 'tmg2@haptiq.com',  pass: 'tmg@123'  },
                      { email: 'mgmt@haptiq.com',  pass: 'mgmt@123' },
                      { email: 'admin@haptiq.com', pass: 'admin@123'},
                    ].map((c) => (
                      <button
                        key={c.email}
                        type="button"
                        onClick={() => { setEmail(c.email); setPassword(c.pass); }}
                        className="col-span-2 grid grid-cols-2 text-left hover:bg-gray-100 rounded-lg px-2 py-1 -mx-2 transition-colors group"
                      >
                        <span className="font-medium text-gray-700 group-hover:text-primary-600 truncate">{c.email}</span>
                        <span className="text-gray-400">{c.pass}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
