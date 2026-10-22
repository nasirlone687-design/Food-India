import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Mail, Lock } from 'lucide-react';
import { authService } from '../services/auth';
import { CopiableErrorAlert } from '../context/ErrorLogContext';

const CustomerAuthScreen: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authService.signIn(email, password, 'customer');
      navigate('/customer');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.signInWithGoogle('customer');
      navigate('/customer');
    } catch (err: any) {
      setError(err.message || 'Google sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col">
      <header className="flex items-center justify-between mb-8">
        <button 
          onClick={() => navigate('/welcome')}
          className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm"
        >
          <ChevronLeft className="text-slate-900" />
        </button>
        <h1 className="text-lg font-bold text-slate-900">Customer Login</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-slate-900 mb-2">Welcome Back</h2>
          <p className="text-slate-500">Sign in to start ordering your favourite food.</p>
        </div>

        <CopiableErrorAlert error={error} className="mb-6" />

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-14 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-orange-500 transition-colors"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-14 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-orange-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 mt-2"
          >
            {loading ? 'SIGNING IN...' : 'SIGN IN'}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-slate-50 text-slate-500 font-medium">Or continue with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full h-14 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
            />
          </svg>
          <span>CONTINUE WITH GOOGLE</span>
        </button>

        <p className="text-center mt-8 text-slate-500 font-medium">
          Don't have an account?{' '}
          <Link to="/customer-register" className="text-orange-600 font-bold hover:underline">
            Register Now
          </Link>
        </p>
      </div>
    </div>
  );
};

export default CustomerAuthScreen;
