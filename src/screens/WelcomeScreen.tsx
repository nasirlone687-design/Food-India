import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShoppingBag, Store, ArrowRight, ShieldCheck, FileText, Phone } from 'lucide-react';
import { Logo } from '../components/Logo';
import { PWAInstallButton } from '../components/PWAInstallButton';

const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 relative overflow-x-hidden max-w-[100vw]">
      {/* Background Decorative Blobs */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full z-10 py-4">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-6 w-full flex flex-col items-center"
        >
          <Logo size="lg" showText={true} className="mb-3" />
          <p className="text-slate-500 font-medium text-xs sm:text-sm max-w-xs">
            Authentic flavours from your favourite local kitchens • Nearest dishes & closest restaurants first
          </p>
        </motion.div>

        <div className="grid gap-3.5 w-full">
          {/* Customer Entry */}
          <motion.button
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            onClick={() => navigate('/customer-auth')}
            className="group bg-white p-5 rounded-[28px] shadow-lg shadow-slate-200/50 border border-slate-100 flex items-center gap-4 text-left hover:border-orange-500 transition-all active:scale-[0.98] w-full"
          >
            <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors shrink-0">
              <ShoppingBag size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-black text-slate-900 truncate">Order Food</h3>
              <p className="text-xs text-slate-400 font-medium line-clamp-2">
                Discover closest kitchens, live GPS delivery & 100% Cash on Delivery
              </p>
            </div>
            <ArrowRight className="text-slate-300 group-hover:text-orange-500 transition-colors shrink-0" size={20} />
          </motion.button>

          {/* Seller Entry */}
          <motion.button
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            onClick={() => navigate('/seller-auth')}
            className="group bg-white p-5 rounded-[28px] shadow-lg shadow-slate-200/50 border border-slate-100 flex items-center gap-4 text-left hover:border-orange-500 transition-all active:scale-[0.98] w-full"
          >
            <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white group-hover:bg-orange-500 transition-colors shrink-0">
              <Store size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-black text-slate-900 truncate">Partner with Us</h3>
              <p className="text-xs text-slate-400 font-medium line-clamp-2">
                List your kitchen • Plan ₹499 + GST (30d) • 0% Commission
              </p>
            </div>
            <ArrowRight className="text-slate-300 group-hover:text-orange-500 transition-colors shrink-0" size={20} />
          </motion.button>

        </div>
      </div>

      {/* Homepage Footer with Official KulgamKart, FSSAI, GST, Udyam & Legal Links */}
      <footer className="max-w-md mx-auto w-full z-10 pt-4 border-t border-slate-200/70 space-y-2.5 text-center">
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-black text-slate-600">
          <Link
            to="/terms"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-orange-400 hover:text-orange-600 transition-colors"
          >
            <FileText size={13} className="text-orange-500" />
            <span>Terms, Privacy & About</span>
          </Link>
          <Link
            to="/privacy"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-orange-400 hover:text-orange-600 transition-colors"
          >
            <ShieldCheck size={13} className="text-emerald-600" />
            <span>Privacy & Refund Policy</span>
          </Link>
        </div>

        <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-2.5 text-[10px] text-slate-600 space-y-1">
          <p className="font-black text-slate-900">
            Food India is a unit of KulgamKart •{' '}
            <a
              href="https://kulgamkart.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-600 underline"
            >
              kulgamkart.in
            </a>
          </p>
          <p className="font-mono font-bold text-slate-700">
            GST: 01BMAPL3192D1CY • Udyam: UDYAM-JK-11-0018721
          </p>
          <p className="font-mono font-bold text-emerald-700">
            FSSAI अनुज्ञिप्त संख्या / License Number: 11026999000072
          </p>
        </div>

        <p className="text-[10px] text-slate-500 font-bold flex flex-wrap items-center justify-center gap-2">
          <span>Support & Refunds Helpline:</span>
          <a href="tel:+918825028335" className="text-orange-600 hover:underline inline-flex items-center gap-0.5">
            <Phone size={10} /> +91 8825028335
          </a>
          <span>•</span>
          <a href="tel:+918825018335" className="text-orange-600 hover:underline inline-flex items-center gap-0.5">
            <Phone size={10} /> +91 8825018335
          </a>
        </p>
      </footer>
    </div>
  );
};

export default WelcomeScreen;
