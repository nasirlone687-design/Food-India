import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShieldCheck, Lock, Mail, Loader2, ArrowLeft } from 'lucide-react';
import { authService } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import { CopiableErrorAlert } from '../context/ErrorLogContext';

const AdminAuthScreen: React.FC = () => {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const profile = await authService.signInAdmin(email, password);
      setEmail('');
      setPassword('');
      await refreshProfile();
      if (profile.role === 'admin') {
        navigate('/admin');
      } else {
        await authService.logout();
        setError('Unauthorized access. Only administrators can enter.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const profile = await authService.signInWithGoogle('admin');
      await refreshProfile();
      if (profile.role === 'admin') {
        navigate('/admin');
      } else {
        await authService.logout();
        setError('Unauthorized access. Only the authorized system administrator can enter.');
      }
    } catch (err: any) {
      setError(err.message || 'Google Admin Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white overflow-x-hidden">
      <motion.button 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => navigate('/welcome')}
        className="absolute top-8 left-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={20} />
        <span className="font-bold text-sm uppercase tracking-widest">Back</span>
      </motion.button>

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-orange-500 rounded-[28px] flex items-center justify-center mx-auto shadow-2xl shadow-orange-500/20 mb-6">
            <ShieldCheck size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter">Admin Portal</h1>
          <p className="text-slate-400 font-medium text-sm">Restricted Access • Authorized Administrator Only</p>
        </div>

        <form onSubmit={handleAdminLogin} autoComplete="off" className="space-y-4">
          <div className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
              <input 
                type="email"
                name="admin_portal_email_unmanaged"
                autoComplete="off"
                placeholder="Enter Authorized Admin Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-orange-500 focus:bg-white/10 transition-all font-medium"
              />
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
              <input 
                type="password"
                name="admin_portal_pass_unmanaged"
                autoComplete="new-password"
                placeholder="Enter Admin Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-orange-500 focus:bg-white/10 transition-all font-medium"
              />
            </div>
          </div>

          <CopiableErrorAlert error={error} dark />

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-slate-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Authenticating...
              </>
            ) : (
              'Enter Command Center'
            )}
          </button>
        </form>

        <div className="relative flex items-center justify-center py-1">
          <div className="border-t border-white/10 w-full" />
          <span className="bg-slate-900 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
            OR
          </span>
          <div className="border-t border-white/10 w-full" />
        </div>

        <button
          type="button"
          onClick={handleAdminGoogleLogin}
          disabled={loading}
          className="w-full bg-white hover:bg-slate-100 border border-white/20 text-slate-900 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 shadow-lg"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
          <span>Sign In with Authorized Google Account</span>
        </button>
      </div>

      <div className="mt-10 text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em] text-center">
        Secured by Food India Infrastructure • Direct Auth Login Only
      </div>
    </div>
  );
};

export default AdminAuthScreen;

