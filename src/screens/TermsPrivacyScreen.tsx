import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  ShieldCheck,
  FileText,
  Phone,
  MessageCircle,
  MapPin,
  CreditCard,
  Trash2,
  AlertTriangle,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { Logo } from '../components/Logo';

const TermsPrivacyScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const getInitialSection = (path: string) => {
    if (path.includes('delete') || path.includes('deletion')) return 'privacy';
    if (path.includes('privacy')) return 'privacy';
    if (path.includes('refund')) return 'refund';
    if (path.includes('about')) return 'about';
    return 'terms';
  };
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'refund' | 'about'>(() =>
    getInitialSection(location.pathname)
  );

  React.useEffect(() => {
    setActiveTab(getInitialSection(location.pathname));
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col overflow-x-hidden max-w-[100vw]">
      <header className="bg-white border-b border-slate-100 px-4 py-4 sticky top-0 z-30 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/welcome'))}
          className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 active:scale-95 transition-transform shrink-0"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <Logo size="sm" showText={false} />
          <div className="truncate">
            <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight truncate">
              Food India Legal, Privacy & About
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
              foodindia.sbs • A Unit of KulgamKart (kulgamkart.in)
            </p>
          </div>
        </div>
        <div className="w-10 shrink-0" />
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-6 pb-20">
        {/* Section Switcher */}
        <div className="grid grid-cols-4 gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`py-2.5 px-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'terms'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Terms
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`py-2.5 px-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'privacy'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Privacy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('refund')}
            className={`py-2.5 px-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'refund'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Refund Policy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`py-2.5 px-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'about'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            About App
          </button>
        </div>

        {/* Official Registration, FSSAI, GST & KulgamKart Unit Banner (Always visible) */}
        <div className="bg-white rounded-3xl p-5 border-2 border-orange-200 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-start gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                <Building2 size={20} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">
                  Official Corporate & Statutory Details
                </span>
                <h2 className="text-sm sm:text-base font-black text-slate-900">
                  Food India is a unit of KulgamKart
                </h2>
              </div>
            </div>
            <a
              href="https://kulgamkart.in"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[11px] font-black flex items-center gap-1 shrink-0"
            >
              <span>kulgamkart.in</span>
              <ExternalLink size={12} />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 block">
                Parent Organization & Website
              </span>
              <span className="font-black text-slate-900">
                KulgamKart (Website:{' '}
                <a
                  href="https://kulgamkart.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 underline"
                >
                  kulgamkart.in
                </a>
                )
              </span>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 block">
                Udyam Registration Number
              </span>
              <span className="font-mono font-black text-slate-900">UDYAM-JK-11-0018721</span>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 block">
                GST Number (GSTIN)
              </span>
              <span className="font-mono font-black text-slate-900">01BMAPL3192D1CY</span>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 block">
                FSSAI अनुज्ञिप्त संख्या / License Number
              </span>
              <span className="font-mono font-black text-emerald-700">11026999000072</span>
            </div>
          </div>
        </div>

        {/* Official Support & Refund Card */}
        <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-orange-500 flex items-center justify-center shrink-0">
              <ShieldCheck size={24} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                Official Helpdesk & Refund Support
              </span>
              <h2 className="text-base font-black mt-0.5">
                Food India Customer & Seller Support
              </h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                For seller subscription verification (Plan ₹499 + 18% GST ₹89.82 = ₹588.82 via UPI{' '}
                <span className="font-mono font-bold text-orange-300">8825018335@axl</span>, GSTIN:{' '}
                <span className="font-mono font-bold text-emerald-300">01BMAPL3192D1CY</span>),
                refunds, order disputes, or account assistance, contact us directly:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-white/10">
            <a
              href="tel:+918825028335"
              className="bg-white/10 hover:bg-white/15 p-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition-colors"
            >
              <Phone size={16} className="text-orange-400 shrink-0" />
              <span className="truncate">+91 8825028335</span>
            </a>
            <a
              href="tel:+918825018335"
              className="bg-white/10 hover:bg-white/15 p-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition-colors"
            >
              <Phone size={16} className="text-emerald-400 shrink-0" />
              <span>+91 8825018335</span>
            </a>
            <a
              href="https://wa.me/918825018335?text=Hello%20Food%20India%20Support%2C%20I%20need%20help%20with%20my%20account%20or%20refund."
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-600 hover:bg-emerald-700 p-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-colors"
            >
              <MessageCircle size={16} />
              <span>WhatsApp Support</span>
            </a>
          </div>
        </div>

        {activeTab === 'terms' && (
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5 text-slate-700 text-xs leading-relaxed">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <FileText size={20} className="text-orange-500" />
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Terms & Conditions of Service
              </h3>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-slate-900 uppercase text-xs">
                1. Corporate Identity, FSSAI & Statutory Registrations
              </h4>
              <p>
                <strong>Food India</strong> is a unit of <strong>KulgamKart</strong> (official website:{' '}
                <a
                  href="https://kulgamkart.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 font-bold underline"
                >
                  kulgamkart.in
                </a>
                ). Our statutory registrations are:
              </p>
              <ul className="list-disc pl-5 space-y-1 font-semibold text-slate-800">
                <li>
                  <strong>Udyam Registration Number:</strong>{' '}
                  <span className="font-mono">UDYAM-JK-11-0018721</span>
                </li>
                <li>
                  <strong>GST Number (GSTIN):</strong>{' '}
                  <span className="font-mono">01BMAPL3192D1CY</span>
                </li>
                <li>
                  <strong>FSSAI अनुज्ञिप्त संख्या / License Number:</strong>{' '}
                  <span className="font-mono">11026999000072</span>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-slate-900 uppercase text-xs">
                2. Platform Overview & 100% COD Ordering
              </h4>
              <p>
                Food India connects local customers with verified Indian kitchens and restaurants. All food orders placed by customers operate on a <strong>100% Cash on Delivery (COD)</strong> basis, payable directly upon delivery.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-slate-900 uppercase text-xs flex items-center gap-1.5">
                <CreditCard size={14} className="text-orange-500" />
                3. Seller Subscription Pricing (Plan ₹499 + 18% GST) & Activation Rule
              </h4>
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-950 space-y-1.5">
                <p className="font-black flex items-center gap-1.5 text-amber-900">
                  <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                  Plan ₹499 + GST (GSTIN: 01BMAPL3192D1CY)
                </p>
                <p>
                  Sellers enjoy <strong>0% commission</strong> on food orders by subscribing to the <strong>₹499 / 30 Days Seller Plan + 18% GST (₹89.82) = Total ₹588.82</strong> via UPI ID <strong>8825018335@axl</strong>.
                </p>
                <p>
                  • After completing your UPI payment to <strong>8825018335@axl</strong>, submit your 12-digit UPI Transaction Reference / UTR ID in the Subscription screen or Seller Verification section.
                </p>
                <p>
                  • Each subscription is valid for <strong>30 calendar days</strong>.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-slate-900 uppercase text-xs flex items-center gap-1.5">
                <MapPin size={14} className="text-orange-500" />
                4. Live Browser GPS Location & 100% Accurate Restaurant Distance
              </h4>
              <p>
                Food India uses your browser/device's native GPS location permission popup to capture live coordinates, auto-fill your 6-digit PIN code, city, district, and state, and display nearby restaurants with <strong>100% accurate distance from the restaurant</strong>.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5 text-slate-700 text-xs leading-relaxed">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <ShieldCheck size={20} className="text-emerald-600" />
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Privacy Policy & Data Protection
              </h3>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-slate-900 uppercase text-xs">
                1. Data Controller & Legal Entity
              </h4>
              <p>
                This platform is operated by <strong>Food India (A Unit of KulgamKart)</strong>, website{' '}
                <a
                  href="https://kulgamkart.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 font-bold underline"
                >
                  kulgamkart.in
                </a>
                , Udyam Registration Number <strong>UDYAM-JK-11-0018721</strong>, GST Number{' '}
                <strong>01BMAPL3192D1CY</strong>, and FSSAI अनुज्ञिप्त संख्या / License Number{' '}
                <strong>11026999000072</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-slate-900 uppercase text-xs">
                2. Information We Collect
              </h4>
              <p>
                We collect your name, email address, mobile phone number, delivery addresses, live GPS coordinates (latitude, longitude, and 6-digit PIN code), and—for sellers—KYC verification documents (FSSAI License, GST/Business License, and Aadhaar/PAN) and UPI transaction reference numbers.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-slate-900 uppercase text-xs">
                3. How We Use Location & Contact Data
              </h4>
              <p>
                Your live GPS location is used exclusively to show nearby dishes and restaurants with 100% accurate distance, auto-fill your delivery PIN code and address, compute delivery fees, and generate direct Google Maps navigation links for order fulfillment.
              </p>
            </div>

            <div className="space-y-2 p-4 bg-red-50/70 border border-red-200 rounded-2xl">
              <h4 className="font-black text-red-900 uppercase text-xs flex items-center gap-1.5">
                <Trash2 size={15} className="text-red-600" />
                4. Account & Data Deletion Policy (Play Store Compliant)
              </h4>
              <p className="text-red-950">
                Food India respects your right to privacy and data removal. Both Customers and Sellers can permanently delete their profile, order history, and saved addresses at any time:
              </p>
              <ul className="space-y-1 text-red-900 font-medium pl-2">
                <li>• <strong>In-App Deletion:</strong> Go to <strong>Profile / Account Settings</strong> and click <strong>&quot;Delete Account&quot;</strong>.</li>
                <li>• <strong>Web Request:</strong> Submit an account deletion request via email to <strong className="font-bold text-red-950">lonen5408@gmail.com</strong> or phone/SMS to <strong className="font-bold text-red-950">+91 8825028335</strong> / <strong className="font-bold text-red-950">+91 8825018335</strong> with your registered phone number or email address. Your data will be deleted within 48 hours.</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'refund' && (
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5 text-slate-700 text-xs leading-relaxed">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <CreditCard size={20} className="text-orange-500" />
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Refund, Cancellation & Subscription Policy
              </h3>
            </div>

            {/* Customer Order Refund & Cancellation Policy */}
            <div className="space-y-3">
              <h4 className="font-black text-slate-900 uppercase text-xs">
                1. Customer Food Orders (Cash on Delivery)
              </h4>
              <div className="space-y-2 text-slate-700">
                <p>
                  • <strong>Order Cancellation:</strong> Customers can cancel any food order free of charge prior to restaurant confirmation and preparation. Once an order is prepared and out for delivery, cancellations are restricted to prevent perishable food wastage.
                </p>
                <p>
                  • <strong>Zero Charge on Cancellation:</strong> Because all orders on Food India are 100% Cash on Delivery (COD), no pre-payment deduction occurs. If an order is cancelled or rejected by the restaurant, the customer owes ₹0.
                </p>
                <p>
                  • <strong>Damaged or Incorrect Items:</strong> If you receive an incorrect, damaged, or spoiled food package, notify the restaurant or our support helpline (+91 8825028335 / +91 8825018335) immediately with photo proof for an instant replacement dish or bill adjustment.
                </p>
              </div>
            </div>

            {/* Seller Subscription Refund Policy */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h4 className="font-black text-slate-900 uppercase text-xs">
                2. Seller Subscription Plan (₹499 + 18% GST)
              </h4>
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl space-y-2">
                <p className="text-xs font-black text-orange-900 uppercase">
                  Seller Subscription: ₹499 + 18% GST (30 Days)
                </p>
                <p className="text-slate-700">
                  • Base Plan Amount: <strong>₹499.00</strong>
                </p>
                <p className="text-slate-700">
                  • GST (18%): <strong>₹89.82</strong> (Official GSTIN: <strong className="font-mono">01BMAPL3192D1CY</strong>)
                </p>
                <p className="text-slate-700">
                  • Total Payable Amount: <strong>₹588.82</strong>
                </p>
                <p className="text-slate-700">
                  • Official UPI ID: <strong className="font-mono text-slate-900">8825018335@axl</strong>
                </p>
              </div>
              <p className="text-slate-700">
                • <strong>Duplicate or Accidental Payments:</strong> If a seller accidentally transfers duplicate amounts or if verification cannot be completed, a full refund of ₹588.82 is processed within 3-5 business days to the originating UPI ID/bank account upon verification.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h4 className="font-black text-slate-900 uppercase text-xs">
                How to Request a Refund / Support
              </h4>
              <p>
                To request a refund or raise an order grievance, please share your order number or UPI Transaction Reference / UTR ID with:
              </p>
              <ul className="space-y-1.5 font-bold text-slate-900 pt-1">
                <li>• Helpline / SMS: +91 8825028335</li>
                <li>• WhatsApp / Call: +91 8825018335 (+8825018335)</li>
                <li>• Official Email: lonen5408@gmail.com</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5 text-slate-700 text-xs leading-relaxed">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <Building2 size={20} className="text-orange-500" />
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                About Food India & Application Details
              </h3>
            </div>

            <p className="text-sm font-bold text-slate-900">
              Food India Official Website: <a href="https://foodindia.sbs" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline font-black">foodindia.sbs</a> • A Unit of KulgamKart (<a href="https://kulgamkart.in" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline">kulgamkart.in</a>).
            </p>

            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2">
                <span className="font-black text-slate-600 uppercase text-[10px]">Official App Website</span>
                <a href="https://foodindia.sbs" target="_blank" rel="noopener noreferrer" className="font-black text-orange-600 underline">
                  foodindia.sbs
                </a>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2">
                <span className="font-black text-slate-600 uppercase text-[10px]">Parent Unit & Website</span>
                <span className="font-black text-slate-900">Food India — A Unit of KulgamKart (kulgamkart.in)</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2">
                <span className="font-black text-slate-600 uppercase text-[10px]">Udyam Registration Number</span>
                <span className="font-mono font-black text-slate-900">UDYAM-JK-11-0018721</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2">
                <span className="font-black text-slate-600 uppercase text-[10px]">GST Number (GSTIN)</span>
                <span className="font-mono font-black text-slate-900">01BMAPL3192D1CY</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2">
                <span className="font-black text-slate-600 uppercase text-[10px]">FSSAI License Number</span>
                <span className="font-mono font-black text-emerald-700">
                  अनुज्ञिप्त संख्या / License Number: 11026999000072
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-black text-slate-600 uppercase text-[10px]">Seller Subscription Plan</span>
                <span className="font-black text-slate-900">
                  ₹499.00 + 18% GST (₹89.82) = ₹588.82 / 30 Days
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TermsPrivacyScreen;
