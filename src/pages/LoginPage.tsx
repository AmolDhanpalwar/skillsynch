import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getRoleHomePath } from '../types';

export default function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 border border-red-100">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span className="font-body">{error}</span>
              </div>
            )}

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
              className="w-full flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-heading font-semibold text-sm px-4 py-3 rounded-xl transition-all active:scale-[0.98] mt-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

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
